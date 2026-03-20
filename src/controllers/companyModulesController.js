const jwt = require("jsonwebtoken");
const Company = require("../models/company");
const User = require("../models/user");
require("dotenv").config();

const SECRET = process.env.JWT_SECRET;

exports.updateModules = async (req, res) => {
  try {
    const companyId = req.user.company._id;
    const userId = req.user.id;
    const { sales, invoicing } = req.body;

    const nextModules = {
      sales: !!sales,
      invoicing: !!invoicing
    };

    if (!nextModules.sales && !nextModules.invoicing) {
      return res.status(400).json({
        status: "error",
        message: "Selecione pelo menos um módulo."
      });
    }

    const company = await Company.findByIdAndUpdate(
      companyId,
      { modules: nextModules },
      { new: true }
    );

    const freshUser = await User.findById(userId).populate("companyId");

    const token = jwt.sign(
      {
        id: freshUser._id,
        name: freshUser.name,
        email: freshUser.email,
        permissions: freshUser.permissions,
        role: freshUser.role,
        company: freshUser.companyId
      },
      SECRET,
      { expiresIn: "1h" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      maxAge: 3600000
    });

    return res.json({
      status: "success",
      message: "Módulos actualizados com sucesso.",
      modules: company.modules
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      status: "error",
      message: "Erro ao atualizar módulos."
    });
  }
};