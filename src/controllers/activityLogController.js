const ActivityLog = require('../models/activityLog');

exports.log = async ({ companyId, userId, userName, action, entity, entityId, description, metadata }) => {
    try {
        await ActivityLog.create({ companyId, userId, userName, action, entity, entityId, description, metadata });
    } catch (err) {
        console.error('Activity log error:', err.message);
    }
};

exports.getActivities = async (req, res) => {
    try {
        const { entity, limit = 30 } = req.query;
        const filter = { companyId: req.user.company._id };
        if (entity) filter.entity = entity;
        const activities = await ActivityLog.find(filter)
            .sort({ createdAt: -1 })
            .limit(Number(limit));
        res.json({ success: true, activities });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};