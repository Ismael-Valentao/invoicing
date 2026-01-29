const Newsletter = require('../models/newsletter');

exports.subscribe = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: 'Email é obrigatório'
      });
    }

    const exists = await Newsletter.findOne({ email });

    if (exists) {
      return res.status(200).json({
        status: 'success',
        message: 'Este email já está subscrito'
      });
    }

    const subscription = await Newsletter.create({
      email,
      source: 'landing-page'
    });

    res.status(201).json({
      status: 'success',
      message: 'Subscrição realizada com sucesso',
      subscription
    });

  } catch (error) {
    res.status(500).json({
      message: 'Erro ao subscrever newsletter',
      error
    });
  }
};
