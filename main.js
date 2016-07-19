'use strict';

class IRCJoinMsg extends global.AKP48.pluginTypes.MessageHandler {
  constructor(AKP48) {
    super(AKP48, 'IRCJoinMsg');
  }

  load() {
    this.perms = [
      'irc.channel.owner',
      'irc.channel.op',
      'irc.channel.protected',
      'irc.channel.halfop',
      'AKP48.owner',
      'AKP48.op'
    ];

    if(!this._config.channels) {
      this._config = {
        channels: {}
      };
      this._config.channels[`${this._AKP48.getUUID()}:#exampleChannel`] = 'This is an example message. Welcome, $user!';
      this._AKP48.saveConfig(this._config, 'irc-join-msg');
    }


    var self = this;
    this._AKP48.on('ircJoin', (channel, nick, instance) => {
      self.handleJoin(channel, nick, instance._id, instance._client);
    });
  }
}

IRCJoinMsg.prototype.handleJoin = function (chan, nick, id, client) {
  global.logger.silly(`${this.name}: Received join event.`);
  var chanConf = this._config.channels[`${id}:${chan}`];
  if(chanConf) {
    var msg = chanConf.msg.replace(/\$user/g, nick);
    if(!chanConf.excludeNicks.includes(nick.toLowerCase())) {
      client.say(chan, msg);
    }
  }
};

IRCJoinMsg.prototype.handleCommand = function (ctx) {
  global.logger.silly(`${this.name}: Received command.`);

  // if this isn't an IRC instance, drop the command.
  if(!ctx.instanceType() || ctx.instanceType() !== 'irc') {
    global.logger.silly(`${this.name}: Dropping command; not IRC instance.`);
    return;
  }
  var good = false;

  for (let perm of ctx.permissions()) {
    if(this.perms.includes(perm)) {
      good = true;
      break;
    }
  }

  if(!good) {global.logger.silly(`${this.name}: Dropping command; no permission.`);return;}

  switch(ctx.command().toLowerCase()) {
    case 'setmessage':
      return this.setMessage(ctx);
    case 'clearmessage':
      return this.clearMessage(ctx);
    case 'excludelist':
      return this.excludeList(ctx);
    case 'exclude':
      return this.exclude(ctx);
    case 'include':
      return this.include(ctx);
    default:
      return;
  }
};

IRCJoinMsg.prototype.setMessage = function (ctx) {
  global.logger.silly(`${this.name}: Handling setMessage.`);
  var id = ctx.instanceId();
  var chan = ctx.to();
  var msg = ctx.argText();

  var confChan = this._config.channels[`${id}:${chan}`];
  if(!confChan) {
    this._config.channels[`${id}:${chan}`] = {};
    confChan = this._config.channels[`${id}:${chan}`];
  }
  confChan.msg = msg;
  confChan.excludeNicks = [];
  this._AKP48.saveConfig(this._config, 'irc-join-msg');
  return ctx.reply(`Join message for ${chan} has been set to "${msg}"`);
};

IRCJoinMsg.prototype.clearMessage = function (ctx) {
  global.logger.silly(`${this.name}: Handling clearMessage.`);
  var id = ctx.instanceId();
  var chan = ctx.to();

  if(this._config.channels[`${id}:${chan}`]) {
    delete this._config.channels[`${id}:${chan}`];
  }
  this._AKP48.saveConfig(this._config, 'irc-join-msg');
  return ctx.reply(`Join message for ${chan} has been cleared.`);
};

IRCJoinMsg.prototype.excludeList = function (ctx) {
  global.logger.silly(`${this.name}: Handling excludeList.`);
  var id = ctx.instanceId();
  var chan = ctx.to();

  var confChan = this._config.channels[`${id}:${chan}`];
  if(!confChan) {
    global.logger.debug(`${this.name}: Refusing to show list for a channel where no message has been set.`);
    ctx.reply(`There is no exclude list, since there is no join message set for this channel.`);
  }
  ctx.reply(confChan.excludeNicks.length ? confChan.excludeNicks.join(', ') : 'The exclude list for this channel is empty.');
};

IRCJoinMsg.prototype.exclude = function (ctx) {
  global.logger.silly(`${this.name}: Handling exclude.`);

  var id = ctx.instanceId();
  var chan = ctx.to();
  var nicks = ctx.rawArgs();

  if(!nicks.length) {
    global.logger.debug(`${this.name}: Refusing to exclude without parameters provided.`);
    return ctx.reply(`You must provide a list of nicks to exclude!`);
  }

  var confChan = this._config.channels[`${id}:${chan}`];
  if(!confChan) {
    global.logger.debug(`${this.name}: Refusing to exclude from channel without a join message set.`);
    return ctx.reply(`Cannot exclude people from a channel where no join message has been set.`);
  }

  for (var i = 0; i < nicks.length; i++) {
    if(confChan.excludeNicks.includes(nicks[i].toLowerCase())) {
      continue;
    }
    confChan.excludeNicks.push(nicks[i].toLowerCase());
  }

  this._AKP48.saveConfig(this._config, 'irc-join-msg');

  var has = (nicks.length === 1) ? 'has' : 'have';
  return ctx.reply(`${nicks.join(', ')} ${has} been added to the exclude list for ${chan}.`);
};

IRCJoinMsg.prototype.include = function (ctx) {
  global.logger.silly(`${this.name}: Handling include.`);

  var id = ctx.instanceId();
  var chan = ctx.to();
  var nicks = ctx.rawArgs();

  if(!nicks.length) {
    global.logger.debug(`${this.name}: Refusing to include without parameters provided.`);
    return ctx.reply(`You must provide a list of nicks to include!`);
  }

  var confChan = this._config.channels[`${id}:${chan}`];
  if(!confChan) {
    global.logger.debug(`${this.name}: Refusing to include in channel without a join message set.`);
    return ctx.reply(`Cannot include people in a channel where no join message has been set.`);
  }

  var removedNicks = [];

  for (var i = 0; i < nicks.length; i++) {
    var nick = nicks[i].toLowerCase();
    if(!confChan.excludeNicks.includes(nick)) {
      continue;
    }
    var index = confChan.excludeNicks.indexOf(nick);
    while(index > -1) {
      confChan.excludeNicks.splice(index, 1);
      index = confChan.excludeNicks.indexOf(nick);
    }
    removedNicks.push(nicks[i]);
  }

  this._AKP48.saveConfig(this._config, 'irc-join-msg');

  var extra = false;
  if(removedNicks.length === 0) {removedNicks = ['nobody']; extra = true;}
  var has = (removedNicks.length === 1) ? 'has' : 'have';
  extra = (removedNicks.length !== nicks.length || extra) ? ' (Some nicks were already not in the exclude list.)' : '';
  return ctx.reply(`${removedNicks.join(', ')} ${has} been removed from the exclude list for ${chan}.${extra}`);
};

module.exports = IRCJoinMsg;
module.exports.type = 'MessageHandler';
module.exports.pluginName = 'irc-join-msg';
