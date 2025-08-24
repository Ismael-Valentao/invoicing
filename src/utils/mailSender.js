const nodemailer = require('nodemailer');

const sendWelcomeEmail = async (toEmail, userName) => {
  const transporter = nodemailer.createTransport({
    host: 'smtp.hostinger.com', // ou smtp.hostinger.com, smtp.titan.email, etc.
    port: 465, // ou 587, depende da tua hospedagem
    secure: true, // true para 465, false para 587
    auth: {
      user: 'info@bitiray.com',
      pass: 'TUA_SENHA_DO_EMAIL',
    },
  });

  const mailOptions = {
    from: '"Bitiray" <info@bitiray.com>',
    to: toEmail,
    subject: 'Bem-vindo!',
    html: `<p>Olá <strong>${userName}</strong>,</p><p>Obrigado por te registares na nossa plataforma!</p>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('E-mail enviado com sucesso!');
  } catch (err) {
    console.error('Erro ao enviar e-mail:', err);
  }
};
