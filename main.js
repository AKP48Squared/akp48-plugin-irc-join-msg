'use strict';

class IRCJoinMsg extends global.AKP48.pluginTypes.MessageHandler {
  constructor(AKP48, config) {
    super('IRCJoinMsg', AKP48);
    var self = this;
    this._config = config;

    this.perms = [
      'irc.channel.owner',
      'irc.channel.op',
      'irc.channel.protected',
      'irc.channel.halfop',
      'AKP48.owner',
      'AKP48.op'
    ];

    if(!this._config) {
      this._config = {
        channels: {}
      };
      this._config.channels[`${this._AKP48.getUUID()}:#exampleChannel`] = 'This is an example message. Welcome, $user!';
      this._AKP48.saveConfig(this._config, 'irc-join-msg');
    }

    this.migrateOldConfig();

    this._AKP48.on('ircJoin', (channel, nick, instance) => {
      self.handleJoin(channel, nick, instance._id, instance._client);
    });
  }
}

IRCJoinMsg.prototype.migrateOldConfig = function () {
  for (var chan in this._config.channels) {
    if (this._config.channels.hasOwnProperty(chan)) {
      var c = this._config.channels[chan];
      if (typeof c === 'string' || c instanceof String) {
        var obj = {
          msg: c,
          excludeNicks: []
        };
        this._config.channels[chan] = obj;
      }
    }
  }
};

IRCJoinMsg.prototype.handleJoin = function (chan, nick, id, client) {
  global.logger.silly(`${this._pluginName}: Received join event.`);
  var chanConf = this._config.channels[`${id}:${chan}`];
  if(chanConf) {
    var msg = chanConf.msg.replace(/\$user/g, nick);
    if(!chanConf.excludeNicks.includes(nick.toLowerCase())) {
      client.say(chan, msg);
    }
  }
};

IRCJoinMsg.prototype.handleCommand = function (msg, ctx, res) {
  global.logger.silly(`${this._pluginName}: Received command.`);

  // if this isn't an IRC instance, drop the command.
  if(!ctx.instanceType || ctx.instanceType !== 'irc') {
    global.logger.silly(`${this._pluginName}: Dropping command; not IRC instance.`);
    return;
  }
  var good = false;

  for (let perm of ctx.permissions) {
    if(this.perms.includes(perm)) {
      good = true;
      break;
    }
  }

  if(!good) {global.logger.silly(`${this._pluginName}: Dropping command; no permission.`);return;}

  if(msg.toLowerCase().startsWith('setmessage')) {
    //remove command from message
    msg = msg.split(' ');
    msg.splice(0, 1);
    msg = msg.join(' ');

    res(this.setMessage(msg, ctx.to, ctx.instanceId));
  }

  if(msg.toLowerCase().startsWith('clearmessage')) {
    res(this.clearMessage(ctx.to, ctx.instanceId));
  }

  if(msg.toLowerCase().startsWith('exclude')) {
    //remove command from message
    msg = msg.split(' ');
    msg.splice(0, 1);

    res(this.excludeList(msg, ctx.to, ctx.instanceId));
  }

  if(msg.toLowerCase().startsWith('include')) {
    //remove command from message
    msg = msg.split(' ');
    msg.splice(0, 1);

    res(this.includeList(msg, ctx.to, ctx.instanceId));
  }
};

IRCJoinMsg.prototype.setMessage = function (msg, chan, id) {
  global.logger.silly(`${this._pluginName}: Handling setMessage.`);
  this._config.channels[`${id}:${chan}`].msg = msg;
  this._config.channels[`${id}:${chan}`].excludeNicks = [];
  this._AKP48.saveConfig(this._config, 'irc-join-msg');
  return `Join message for ${chan} has been set to "${msg}"`;
};

IRCJoinMsg.prototype.clearMessage = function (chan, id) {
  global.logger.silly(`${this._pluginName}: Handling clearMessage.`);
  if(this._config.channels[`${id}:${chan}`]) {
    delete this._config.channels[`${id}:${chan}`];
  }
  this._AKP48.saveConfig(this._config, 'irc-join-msg');
  return `Join message for ${chan} has been cleared.`;
};

IRCJoinMsg.prototype.excludeList = function (nicks, chan, id) {
  global.logger.silly(`${this._pluginName}: Handling exclude.`);

  if(!nicks.length) {
    global.logger.debug(`${this._pluginName}: Refusing to exclude without parameters provided.`);
    return `You must provide a list of nicks to exclude!`;
  }

  var confChan = this._config.channels[`${id}:${chan}`];
  if(!confChan) {
    global.logger.debug(`${this._pluginName}: Refusing to exclude from channel without a join message set.`);
    return `Cannot exclude people from a channel where no join message has been set.`;
  }

  for (var i = 0; i < nicks.length; i++) {
    if(confChan.excludeNicks.includes(nicks[i].toLowerCase())) {
      continue;
    }
    confChan.excludeNicks.push(nicks[i].toLowerCase());
  }

  this._AKP48.saveConfig(this._config, 'irc-join-msg');

  var has = (nicks.length === 1) ? 'has' : 'have';
  return `${nicks.join(', ')} ${has} been added to the exclude list for ${chan}.`;
};

IRCJoinMsg.prototype.includeList = function (nicks, chan, id) {
  global.logger.silly(`${this._pluginName}: Handling include.`);

  if(!nicks.length) {
    global.logger.debug(`${this._pluginName}: Refusing to include without parameters provided.`);
    return `You must provide a list of nicks to include!`;
  }

  var confChan = this._config.channels[`${id}:${chan}`];
  if(!confChan) {
    global.logger.debug(`${this._pluginName}: Refusing to include in channel without a join message set.`);
    return `Cannot include people in a channel where no join message has been set.`;
  }

  var removedNicks = [];

  for (var i = 0; i < nicks.length; i++) {
    if(!confChan.excludeNicks.includes(nicks[i])) {
      continue;
    }
    var index = confChan.excludeNicks.indexOf(nicks[i]);
    while(index > -1) {
      confChan.excludeNicks.splice(index, 1);
      index = confChan.excludeNicks.indexOf(nicks[i]);
    }
    removedNicks.push(nicks[i]);
  }

  this._AKP48.saveConfig(this._config, 'irc-join-msg');

  var extra = false;
  if(removedNicks.length === 0) {removedNicks = ['nobody']; extra = true;}
  var has = (removedNicks.length === 1) ? 'has' : 'have';
  extra = (removedNicks.length !== nicks.length || extra) ? ' (Some nicks were already not in the exclude list.)' : '';
  return `${removedNicks.join(', ')} ${has} been removed from the exclude list for ${chan}.${extra}`;
};

module.exports = IRCJoinMsg;
module.exports.type = 'MessageHandler';
module.exports.pluginName = 'irc-join-msg';
