'use strict';
const MessageHandlerPlugin = require('../../lib/MessageHandlerPlugin');

class IRCJoinMsg extends MessageHandlerPlugin {
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

    this._AKP48.on('ircJoin', (channel, nick, instance) => {
      self.handleJoin(channel, nick, instance._id, instance._client);
    });
  }
}

IRCJoinMsg.prototype.handleJoin = function (chan, nick, id, client) {
  global.logger.silly(`${this._pluginName}: Received join event.`);
  if(this._config.channels[`${id}:${chan}`]) {
    var msg = this._config.channels[`${id}:${chan}`].replace(/\$user/g, nick);
    client.say(channel, msg);
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
};

IRCJoinMsg.prototype.setMessage = function (msg, chan, id) {
  global.logger.silly(`${this._pluginName}: Handling setMessage.`);
  this._config.channels[`${id}:${chan}`] = msg;
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

module.exports = IRCJoinMsg;
