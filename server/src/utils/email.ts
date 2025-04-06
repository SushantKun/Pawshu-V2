/**
 * Email service utility
 * NOTE: This is a placeholder implementation that logs email details
 * but doesn't actually send emails yet.
 */

interface EmailData {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

/**
 * Send an email (currently just logs the email details)
 * @param data Email data including recipient, subject, and content
 */
export const sendEmail = async (data: EmailData): Promise<boolean> => {
  try {
    // Log the email details instead of actually sending
    console.log('--------------------------------');
    console.log('EMAIL WOULD BE SENT:');
    console.log(`To: ${data.to}`);
    console.log(`Subject: ${data.subject}`);
    console.log(`Content: ${data.text || data.html}`);
    console.log('--------------------------------');
    
    // When ready to implement actual email sending:
    // 1. Install nodemailer: npm install --save nodemailer
    // 2. Install types: npm install --save-dev @types/nodemailer
    // 3. Uncomment and implement the code below
    
    /*
    import { createTransport } from 'nodemailer';
    
    const transporter = createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT || 587),
      secure: Boolean(process.env.EMAIL_SECURE === 'true'),
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: data.to,
      subject: data.subject,
      text: data.text,
      html: data.html,
    });
    */
    
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};

export default { sendEmail }; 