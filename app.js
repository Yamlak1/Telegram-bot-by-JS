const express = require('express');
const { Telegraf, session } = require('telegraf');
const { Sequelize, DataTypes } = require('sequelize');
const dotenv = require('dotenv');
const fs = require('fs');
const AWS = require('aws-sdk');

// Load environment variables from .env file
dotenv.config();

// Create an Express app
const app = express();

// Initialize Telegraf bot
const bot = new Telegraf(process.env.BOT_TOKEN);

// Enable session middleware
bot.use(session());

// Connect to SQLite database using Sequelize
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'database.sqlite'
});

// Define User model
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  role: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'user'
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

// Define Admin model
const Admin = sequelize.define('Admin', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  }
});

// Middleware to check if the user is an admin
bot.use(async (ctx, next) => {
  const { id } = ctx.from;
  const admin = await Admin.findOne({ where: { username: id } });
  if (admin) {
    // If the user is an admin, attach isAdmin flag to ctx object
    ctx.isAdmin = true;
  } else {
    ctx.isAdmin = false;
  }
  next();
});

// Command to register as a user
bot.command('register', async (ctx) => {
  const { id, username } = ctx.from;
  try {
    const user = await User.create({ username });
    ctx.reply(`You have been successfully registered as a user. Your registration date is: ${user.createdAt}`);
  } catch (error) {
    console.error('Error registering user:', error);
    ctx.reply('Error registering user.');
  }
});


// Command to start the bot and display available commands
bot.command('start', async (ctx) => {
  ctx.reply(`Welcome to the bot!\n\n` +
            `Commands available:\n/register - Register as a user\n/adminregister - Register as an admin\n/myinfo - View your registration info\n/listusers - List all registered users`);
});

// Command to register as an admin
bot.command('adminregister', async (ctx) => {
  const { id, username } = ctx.from;
  try {
    const admin = await Admin.create({ username });
    ctx.reply(`You have been successfully registered as an admin.`);
  } catch (error) {
    console.error('Error registering admin:', error);
    ctx.reply('Error registering admin.');
  }
});

// Command to list all registered users
bot.command('listusers', async (ctx) => {
  if (!ctx.isAdmin) {
    ctx.reply('You are not authorized to use this command.');
    return;
  }
  try {
    const users = await User.findAll();
    let userList = '';
    users.forEach(user => {
      userList += `Username: ${user.username}, Registration Date: ${user.createdAt}\n`;
    });
    ctx.reply(`List of registered users:\n${userList}`);
  } catch (error) {
    console.error('Error listing users:', error);
    ctx.reply('Error listing users.');
  }
});

bot.command('myinfo', async (ctx) => {
  const { username } = ctx.from;
  console.log('User ID:', username); // Log the user's ID

  try {
    const user = await User.findOne({ where: { username: username } });
    console.log('User found:', user); // Log the user object retrieved from the database
    if (user) {
      ctx.reply(`Your registration date is: ${user.createdAt}`);
    } else {
      ctx.reply('You are not registered yet.');
    }
  } catch (error) {
    console.error('Error fetching user info:', error);
    ctx.reply('Error fetching user info.');
  }
});

// Synchronize the defined models with the database
sequelize.sync()
  .then(() => {
    console.log('Database & tables created!');
    // Launch the bot after the database is synced
    bot.launch();
  })
  .catch(err => console.error('Error syncing database:', err));

// Configure AWS credentials
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

// Create an S3 instance
const s3 = new AWS.S3();

// Upload database file to S3 on process exit
process.on('exit', async () => {
  try {
    const data = fs.readFileSync('database.sqlite'); // Read the SQLite database file
    const params = {
      Bucket: process.env.AWS_S3_BUCKET, // Your S3 bucket name
      Key: 'database.sqlite', // Name of the file in S3
      Body: data
    };
    await s3.upload(params).promise(); // Upload the file to S3
    console.log('Database file uploaded to S3 successfully');
  } catch (error) {
    console.error('Error uploading database file to S3:', error);
  }
});

// Route to handle incoming messages from Telegram
app.post(`/bot${process.env.BOT_TOKEN}`, (req, res) => {
  bot.handleUpdate(req.body, res);
});

// Start the Express app
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
