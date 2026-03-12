const Admin = require('../models/Admin');
const User = require('../models/User');

const DEFAULT_ADMIN = {
  name: 'shashank M',
  email: 'shashankmuralidharan0@gmail.com',
  password: '121212',
  role: 'admin',
};
const DEFAULT_ADMIN = {
  name: 'Hruthik M',
  email: 'hruthikmuralidharan0@gmail.com',
  password: '121212',
  role: 'admin',
};

const ensureDefaultAdmin = async () => {
  await User.deleteMany({
    $or: [{ email: DEFAULT_ADMIN.email }, { name: DEFAULT_ADMIN.name }],
  });

  const existingAdmin = await Admin.findOne({
    $or: [{ email: DEFAULT_ADMIN.email }, { name: DEFAULT_ADMIN.name }],
  }).select('+password');

  if (existingAdmin) {
    existingAdmin.name = DEFAULT_ADMIN.name;
    existingAdmin.email = DEFAULT_ADMIN.email;
    existingAdmin.role = DEFAULT_ADMIN.role;
    existingAdmin.password = DEFAULT_ADMIN.password;
    existingAdmin.isBlocked = false;
    existingAdmin.failedAttempts = 0;
    await existingAdmin.save();
    console.log('Default admin account synchronized');
    return;
  }

  await Admin.create(DEFAULT_ADMIN);

  console.log('Default admin account created');
};

module.exports = ensureDefaultAdmin;
