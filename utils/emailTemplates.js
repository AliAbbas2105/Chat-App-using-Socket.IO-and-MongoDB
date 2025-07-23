exports.welcomeEmailTemplate = (name) => `
  <h2>Welcome, ${name}!</h2>
  <p>Your email has been verified successfully. You can now log in to your account.</p>
  <p>You are now registered user of Code Xperts</p>
`;

exports.linkEmailTemplate = (link) => `
  <div style="font-family:sans-serif; padding:20px; text-align:center">
    <h2>Welcome!</h2>
    <p>Click the button below to confirm your email and complete registration.</p>
    <a href="${link}" style="background-color:#4CAF50;color:white;padding:10px 20px;
       text-decoration:none;border-radius:5px;display:inline-block;margin-top:10px;">
      Confirm Email
    </a>
    <p>This link will expire in 1 hour.</p>
  </div>
`;