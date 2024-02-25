const express = require('express');
const { Telegraf, session } = require('telegraf');
const { Sequelize, DataTypes } = require('sequelize');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);
bot.use(session());

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'database.sqlite'
});

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

bot.use(async (ctx, next) => {
  const { id } = ctx.from;
  const admin = await Admin.findOne({ where: { username: id } });
  if (admin) {
    ctx.isAdmin = true;
  } else {
    ctx.isAdmin = false;
  }
  next();
});

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

bot.command('start', async (ctx) => {
  ctx.reply(`Welcome to the bot!\n\n` +
            `Commands available:\n/register - Register as a user\n/adminregister - Register as an admin\n/myinfo - View your registration info\n/listusers - List all registered users`);
});

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
  console.log('User ID:', username);

  try {
    const user = await User.findOne({ where: { username: username } });
    console.log('User found:', user);
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

sequelize.sync()
  .then(() => {
    console.log('Database & tables created!');
    bot.launch();
  })
  .catch(err => console.error('Error syncing database:', err));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
