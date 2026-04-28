const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');
const Admin = require('../models/Admin');

const seedAdmin = async () => {
  try {
    const email = 'coder.haseeb@gmail.com';
    const password = 'HaseeB012';
    const fullName = 'Super Admin';

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      console.log('✅ Super Admin already exists');
      return;
    }

    // Hash the password
    const hashedPassword = await bcryptjs.hash(password, 12);

    // Create super admin
    const admin = new Admin({
      fullName,
      email,
      passwordHash: hashedPassword,
    });

    await admin.save();
    console.log('✅ Super Admin created successfully');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
  } catch (error) {
    console.error('❌ Error seeding admin:', error.message);
  }
};

module.exports = seedAdmin;
