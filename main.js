'use strict';
const MessageHandlerPlugin = require('../../lib/MessageHandlerPlugin');

class IRCJoinMsg extends MessageHandlerPlugin {
  constructor(AKP48, config) {
    super('IRCJoinMsg', AKP48);
    var self = this;
    this.instances = [];
    this._config = config;
    this._handle = null;

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
        channels: {
          '#exampleChannel': 'This is an example message. Welcome, $user!'
        }
      };
      this._AKP48.saveConfig(this._config, 'irc-join-msg');
    }

    this._AKP48.on('serverConnect', (id, instance) => {
      self.instances.push(instance);

      if(!self._handle) {
        self._handle = function(channel, nick){
          self.handleJoin(channel, nick, instance);
        };
      }

      instance.on('join', self._handle);
    });
  }

  unload() {
    for (let svr of this.instances) {
      svr.removeListener('join', this._handleJoin);
    }
    return true;
  }
}

IRCJoinMsg.prototype.handleJoin = function (channel, nick, instance) {
  GLOBAL.logger.silly(`${this._pluginName}: Received join event.`);
  if(this._config.channels[channel]) {
    var msg = this._config.channels[channel].replace(/\$user/g, nick);
    instance.say(channel, msg);
  }
};

IRCJoinMsg.prototype.handleMessage = function (msg, ctx, res) {

  GLOBAL.logger.silly(`${this._pluginName}: Received command.`);
  // if this isn't an IRC instance, drop the command.
  if(!ctx.instanceType || ctx.instanceType !== 'irc') {
    GLOBAL.logger.silly(`${this._pluginName}: Dropping command; not IRC instance.`);
    return;
  }
  var good = false;

  for (let perm in ctx.perms) {
    if(this.perms.contains(perm)) {
      good = true;
      break;
    }
  }

  if(!good) {return;}

  if(msg.toLowerCase().startsWith('setmessage ')) {
    //remove command from message
    msg = msg.split(' ');
    msg.splice(1, 0);
    msg = msg.join(' ');

    res(this.setMessage(msg, ctx));
  }

  if(msg.toLowerCase().startsWith('clearmessage ')) {
    res(this.clearMessage(ctx));
  }
};

IRCJoinMsg.prototype.setMessage = function (msg, chan) {
  this._config.channels[chan] = msg;
  this._AKP48.saveConfig(this._config, 'irc-join-msg');
  return `Join message for ${chan} has been set to "${msg}"`;
};

IRCJoinMsg.prototype.clearMessage = function (chan) {
  if(this._config.channels[chan]) {
    delete this._config.channels[chan];
  }
  this._AKP48.saveConfig(this._config, 'irc-join-msg');
  return `Join message for ${chan} has been cleared.`;
};

module.exports = IRCJoinMsg;
