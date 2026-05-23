const { Sequelize } = require('sequelize');
const mysql = require('mysql2/promise');

// Database credentials from env or defaults
const dbName = process.env.DB_NAME || 'cold_chain_erp';
const dbUser = process.env.DB_USER || 'root';
const dbPassword = process.env.DB_PASSWORD || '';
const dbHost = process.env.DB_HOST || '127.0.0.1';
const dbPort = process.env.DB_PORT || 3306;

// Instantiate Sequelize connection to MySQL database
const sequelize = new Sequelize(dbName, dbUser, dbPassword, {
  host: dbHost,
  port: dbPort,
  dialect: 'mysql',
  logging: false, // Disable verbose logs in console
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  define: {
    timestamps: true // Adds createdAt and updatedAt
  }
});

/**
 * Connects and authenticates to the MySQL Database, then synchronizes models.
 * Automatically creates the database if it does not exist yet.
 */
const connectDB = async () => {
  try {
    // 1. Ensure the database exists on the MySQL server
    const connection = await mysql.createConnection({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword
    });
    
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
    await connection.end();
    
    // 2. Authenticate the Sequelize instance
    await sequelize.authenticate();
    console.log('🚀 MySQL Database connected successfully.');
    
    // 3. Sync all models to create tables in database (alter: true updates columns without dropping data)
    await sequelize.sync({ alter: true });
    console.log('📦 All MySQL Database tables synced successfully.');
  } catch (error) {
    console.error('❌ MySQL Connection Error:', error.message);
    process.exit(1);
  }
};

module.exports = {
  sequelize,
  connectDB
};
