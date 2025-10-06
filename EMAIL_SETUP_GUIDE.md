# Email Authentication Setup Guide

## 🚀 **New Feature: Gmail Authentication**

The extension now supports Gmail authentication so you can send emails directly from your own account (`lawrencehua2@gmail.com`). No more configuration files needed!

## 📧 **Gmail App Password Setup**

Since you're using Gmail, you'll need to create an **App Password** for security:

### Step 1: Enable 2-Factor Authentication
1. Go to your [Google Account settings](https://myaccount.google.com/)
2. Click "Security" in the left sidebar
3. Under "Signing in to Google", click "2-Step Verification"
4. Follow the steps to enable 2FA if not already enabled

### Step 2: Generate App Password
1. Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
2. Select "Mail" for the app
3. Select "Other (Custom name)" for device
4. Enter "TheNetwrk Extension" as the name
5. Click "Generate"
6. **Copy the 16-character password** (it looks like: `vpfy eypf qjxu xsxa`)

## 🔐 **Login Process**

### In the Chrome Extension:

1. **Open the Extension**: Click the TheNetwrk extension icon
2. **Click "Login"**: You'll see a "❌ Not logged in" status with a "Login" button
3. **Enter Credentials**:
   - Email: `lawrencehua2@gmail.com`
   - Password: Use the 16-character App Password (not your regular Gmail password)
4. **Click "Login"**: The system will verify your credentials
5. **Success**: You'll see "✅ Logged in as: lawrencehua2@gmail.com"

## 📨 **How Email Sending Works Now**

### Before Authentication:
- ❌ Emails cannot be sent
- Error: "Please log in with your email credentials to send emails"

### After Authentication:
- ✅ Emails are sent from your Gmail account
- ✅ AI-generated personalized messages
- ✅ Professional sender identity
- ✅ All emails appear in your Gmail "Sent" folder

## 🔄 **Complete Workflow**

1. **Login** → Extension popup → Enter Gmail + App Password
2. **Visit LinkedIn** → Any profile page
3. **Click "Add to TheNetwrk"** → Saves prospect + generates AI message
4. **Message Generated** → Copied to clipboard for LinkedIn messaging
5. **Email Ready** → Backend can now send emails from your account

## 🛡️ **Security Features**

- **Credential Verification**: Tests your email credentials before storing
- **Session Management**: Login persists until you logout
- **Secure Storage**: Credentials stored securely in extension storage
- **Real-time Status**: Shows current authentication status

## 🧪 **Testing Email Authentication**

### Test 1: Login Process
```bash
# Backend should be running on port 3000
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"lawrencehua2@gmail.com","password":"your-app-password"}'
```

### Test 2: Check Status
```bash
curl http://localhost:3000/api/auth/status
```

### Test 3: Send Test Email (after login)
```bash
curl -X POST http://localhost:3000/api/send-email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "subject": "Test from TheNetwrk",
    "body": "This is a test email from your authenticated Gmail account!",
    "prospectId": "test123"
  }'
```

## 🔧 **Troubleshooting**

### "Login Failed" Error:
- ✅ Make sure you're using the **App Password**, not your regular Gmail password
- ✅ Check that 2-Factor Authentication is enabled on your Google account
- ✅ Verify the email address is exactly `lawrencehua2@gmail.com`
- ✅ Try generating a new App Password

### "Email Service Not Configured":
- ✅ Make sure the backend server is running (`npm start` in the backend folder)
- ✅ Check that the extension can reach `http://localhost:3000`

### Extension Not Working:
- ✅ Reload the extension in Chrome (`chrome://extensions/`)
- ✅ Check the browser console for errors (F12 → Console)
- ✅ Make sure you're on a LinkedIn profile page

## 📱 **UI Changes**

The extension popup now shows:

### When Not Logged In:
```
❌ Not logged in          [Login]
```

### When Logging In:
```
Email Login
Login with your Gmail credentials to send emails

[lawrencehua2@gmail.com    ]
[App Password             ]
[Login]

Use your Gmail App Password. Learn how
```

### When Logged In:
```
✅ Logged in as: lawrencehua2@gmail.com    [Logout]
```

## 🎯 **Next Steps**

1. **Set up App Password** following the guide above
2. **Login** through the extension
3. **Test** on a LinkedIn profile
4. **Verify** emails are sent from your Gmail account

The system now provides a seamless experience where you authenticate once and can send personalized emails directly from your Gmail account!