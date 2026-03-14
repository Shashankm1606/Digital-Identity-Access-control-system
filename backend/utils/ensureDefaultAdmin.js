const Admin = require('../models/Admin');
const User = require('../models/User');

// Load admin credentials from environment variables with validation
const getDefaultAdmins = () => {
  const admins = [];
  
  // First admin (required for production)
  const admin1Email = process.env.DEFAULT_ADMIN_EMAIL;
  const admin1Password = process.env.DEFAULT_ADMIN_PASSWORD;
  const admin1Name = process.env.DEFAULT_ADMIN_NAME || 'Admin';
  
  if (admin1Email && admin1Password) {
    admins.push({
      name: admin1Name,
      email: admin1Email.toLowerCase().trim(),
      password: admin1Password,
      role: 'admin',
    });
  } else if (process.env.NODE_ENV === 'development') {
    // Fallback for development only
    admins.push({
      name: 'shashank M',
      email: 'shashankmuralidharan0@gmail.com',
      password: '121212',
      role: 'admin',
    });
    admins.push({
      name: 'Hruthik M',
      email: 'hruthikmuralidharan0@gmail.com',
      password: '121212',
      role: 'admin',
    });
  }
  
  // Second admin (optional)
  const admin2Email = process.env.DEFAULT_ADMIN_EMAIL_2;
  const admin2Password = process.env.DEFAULT_ADMIN_PASSWORD_2;
  const admin2Name = process.env.DEFAULT_ADMIN_NAME_2 || 'Admin 2';
  
  if (admin2Email && admin2Password) {
    admins.push({
      name: admin2Name,
      email: admin2Email.toLowerCase().trim(),
      password: admin2Password,
      role: 'admin',
    });
  }
  
  return admins;
};

const ensureDefaultAdmin = async () => {
  const DEFAULT_ADMINS = getDefaultAdmins();
  
  if (DEFAULT_ADMINS.length === 0) {
    console.log('No default admin credentials configured. Set DEFAULT_ADMIN_EMAIL and DEFAULT_ADMIN_PASSWORD environment variables.');
    return;
  }
  
  for (const admin of DEFAULT_ADMINS) {
    const email = (admin.email || '').toLowerCase().trim();

    await User.deleteMany({ email });

    const existingAdmin = await Admin.findOne({ email }).select('+password');

    if (existingAdmin) {
      existingAdmin.name = admin.name;
      existingAdmin.email = email;
      existingAdmin.role = admin.role;
      existingAdmin.password = admin.password;
      existingAdmin.isBlocked = false;
      existingAdmin.failedAttempts = 0;
      await existingAdmin.save();
      console.log(`Default admin account synchronized: ${email}`);
      continue;
    }

    await Admin.create({ ...admin, email });
    console.log(`Default admin account created: ${email}`);
  }
};

module.exports = ensureDefaultAdmin;
