const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: "mhaseeb.webdev@gmail.com",
    pass: "akdn cwcp pxdh bsbm",
  },
});

const sendMail = async (to, subject, html) => {
  try {
    const result = await transporter.sendMail({
      from: "mhaseeb.webdev@gmail.com",
      to,
      subject,
      html,
    });
    console.log(`✅ Email sent to ${to}`);
    return result;
  } catch (error) {
    console.error('❌ Email send error:', error);
    throw error;
  }
};

module.exports = {
  transporter,
  sendMail,
};
