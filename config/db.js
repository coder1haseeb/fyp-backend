const mongoose = require('mongoose');
const dns = require('node:dns');

let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    console.log('Using existing database connection');
    return;
  }

  try {
    let conn;
    try {
      conn = await mongoose.connect(process.env.MONGO_URI);
    } catch (error) {
      // Some local DNS servers resolve Atlas SRV records but time out on its TXT record.
      if (process.env.MONGO_URI?.startsWith('mongodb+srv://') &&
          error.code === 'ETIMEOUT' && error.syscall === 'queryTxt') {
        const servers = (process.env.MONGO_DNS_SERVERS || '1.1.1.1,8.8.8.8')
          .split(',').map(server => server.trim()).filter(Boolean);
        dns.setServers(servers);
        console.warn(`MongoDB DNS timed out; retrying with DNS servers: ${servers.join(', ')}`);
        conn = await mongoose.connect(process.env.MONGO_URI);
      } else {
        throw error;
      }
    }

    isConnected = !!conn.connection.readyState;
    console.log('✅ MongoDB Connected Successfully');
    console.log(`📍 Database: ${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    throw error;
  }
};

module.exports = { connectDB };
