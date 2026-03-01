const Company = require("../models/company");

exports.updateModules = async (req, res) => {
  try {
    const companyId = req.user.company._id;
    const { sales, invoicing } = req.body;

    // validação simples
    const nextModules = {
      sales: !!sales,
      invoicing: !!invoicing
    };

    console.log(nextModules)

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

    return res.json({ status: "success", modules: company.modules });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ status: "error", message: "Erro ao atualizar módulos." });
  }
};