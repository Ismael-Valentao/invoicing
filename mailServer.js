const nodemailer = require('nodemailer');
require('dotenv').config();

const sendWelcomeEmail = async (toEmail, userName) => {
    const transporter = nodemailer.createTransport({
        host: 'smtp.hostinger.com',
        port: 465,
        secure: true,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const mailOptions = {
        from: '"Invoicing" <invoicing@bitiray.com>',
        to: toEmail,
        subject: 'Bem-vindo à Invoicing',
        html: `
    <div style="background-color:#f4f6f8; padding:30px 0;">
    <div style="
      max-width:600px;
      margin:0 auto;
      background:#ffffff;
      border-radius:8px;
      padding:30px;
      font-family:Arial, Helvetica, sans-serif;
      color:#333;
      line-height:1.6;
    ">

      <!-- Header -->
      <h2 style="color:#228CDF; margin-top:0; text-align:center;">
        Bem-vindo à Invoicing
      </h2>

      <p>Olá, <strong>${userName}</strong>,</p>

      <p>
        É um prazer ter-te connosco!
        A tua conta na <strong>Invoicing</strong> foi criada com sucesso e já
        podes começar a gerir <strong>cotações, recibos e facturas</strong>
        de forma simples, rápida e profissional.
      </p>

      <p>
      O que a plataforma Invoicing te oferece:
      </p>

      <!-- Lista de benefícios -->
      <ul style="padding-left:18px;">
        <li>Criar cotações em poucos cliques</li>
        <li>Emitir recibos e facturas profissionais</li>
        <li>Organizar o histórico financeiro</li>
        <li>Ganhar mais credibilidade com os teus clientes</li>
      </ul>

      <!-- Botão principal -->
      <div style="text-align:center; margin:30px 0;">
        <a
          href="https://invoicing-h19p.onrender.com/"
          style="
            background-color:#228CDF;
            color:#ffffff;
            text-decoration:none;
            padding:14px 28px;
            border-radius:6px;
            font-weight:bold;
            display:inline-block;
          "
        >
          Aceder à plataforma
        </a>
      </div>

      <!-- Ajuda e suporte -->
      <div style="
        background:#f8f9fb;
        border-radius:6px;
        padding:20px;
      ">
        <p style="margin-top:0;">
          <strong>Precisas de ajuda?</strong>
        </p>

        <p style="margin-bottom:8px;">
          Consulta os nossos recursos:
        </p>

        <ul style="padding-left:18px; margin-top:0;">
          <li>
            <a href="mailto:suporte@bitiray.com" style="color:#228CDF;">
              Centro de Ajuda
            </a>
          </li>
        </ul>
      </div>

      <!-- Assinatura -->
      <p style="margin-top:30px;">
        Desejamos-te muito sucesso<br><br>
        Com os melhores cumprimentos,<br>
        <strong>Equipa Invoicing</strong><br>
        <a href="https://bitiray.com" style="color:#777; text-decoration:none;">
          website: bitiray.com
        </a>
      </p>

      <hr style="margin-top:40px; border:none; border-top:1px solid #eee;" />

      <!-- Rodapé -->
      <p style="font-size:12px; color:#999; text-align:center;">
        Este e-mail foi enviado automaticamente.  
        Por favor, não respondas a esta mensagem.
      </p>

    </div>
  </div>
`  };

    try {
        await transporter.sendMail(mailOptions);
        console.log('E-mail enviado com sucesso!');
    } catch (err) {
        console.error('Erro ao enviar e-mail:', err);
    }
};

sendWelcomeEmail("milianomax361@gmail.com", "Ismael Chiziane");