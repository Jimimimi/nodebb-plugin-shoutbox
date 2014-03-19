define(function() {
	var Utils, Config, userCheck;

	var Base = {
		init: function(callback) {
			//todo I hate this
			require([
				'plugins/nodebb-plugin-shoutbox/public/js/lib/utils.js',
				'plugins/nodebb-plugin-shoutbox/public/js/lib/config.js'], function(u, c) {
				Config = c;
				u.init(Base, c, function() {
					Utils = u;
					callback();
				});
			});
		},
		load: function(callback) {
			Utils.checkAnon(function(isAnon) {
				if(!isAnon) {
					Utils.prepareShoutbox(Base, callback);
				}
			});
		},
		addShout: function(shoutBox, shout) {
			if (shout && shout.sid) {
				var shoutContent = shoutBox.find('#shoutbox-content');
				if (shoutContent.find('div[class="shoutbox-shout-container"]').length === 0) {
					shoutContent.html('');
				}
				if (shout.fromuid === shoutContent.find('[data-uid]:last').data('uid')) {
					$('[data-sid]:last').after(Utils.parseShout(shout, true));
				} else {
					shoutContent.append(Utils.parseShout(shout));
				}
				Base.scrollToBottom(shoutContent);
			}
		},
		getShouts: function(shoutBox) {
			socket.emit(Config.sockets.get, function(err, shouts) {
				if (shouts.length === 0) {
					Utils.showEmptyMessage(shoutBox);
				} else {
					for(var i = 0; i < shouts.length; i++) {
						Base.addShout(shoutBox, shouts[i]);
					}
					Base.updateUserStatus(shoutBox);
				}
			});
		},
		scrollToBottom: function(shoutContent) {
			if(shoutContent[0]) {
				shoutContent.scrollTop(
					shoutContent[0].scrollHeight - shoutContent.height()
				);
			}
		},
		updateUserStatus: function(shoutBox, uid, status) {
			var getStatus = function(uid) {
				socket.emit(Config.sockets.getUserStatus, uid, function(err, data) {
					setStatus(uid, data.status);
				});
			}
			var setStatus = function(uid, status) {
				shoutBox.find('[data-uid="' + uid + '"] > img').removeClass().addClass('shoutbox-shout-avatar ' + status);
			}

			if (!uid) {
				uid = [];
				shoutBox.find('[data-uid]').each(function(index, el){
					uid.push($(el).data('uid'))
				});
				uid = uid.filter(function(el, index) {
					return uid.indexOf(el) === index;
				});
			}

			if (!status) {
				if (typeof(uid) === 'number') {
					getStatus(uid);
				} else if (Array.isArray(uid)) {
					for(var i = 0, l = uid.length; i < l; i++) {
						getStatus(uid[i]);
					}
				}
			} else {
				if (typeof(uid) === 'number') {
					setStatus(uid, status);
				} else if (Array.isArray(uid)) {
					for(var i = 0, l = uid.length; i < l; i++) {
						setStatus(uid[i], status);
					}
				}
			}
		},
		updateUsers: function() {
			socket.emit(Config.sockets.getUsers, {}, function(err, data) {
				var userCount = data.length;
				var usernames = data.map(function(i) {
					return (i.username === null ? 'Anonymous' : i.username);
				});
				var userString = usernames.join('; ');
				Base.getUsersPanel().find('.panel-body').text(userString);
				Base.getUsersPanel().find('.panel-title').text('Users (' + userCount + ')');
			});
			if(userCheck === 0) {
				userCheck = setInterval(function() {
					Base.updateUsers();
				}, 10000);
			}
		},
		getShoutPanel: function() {
			return $('#shoutbox');
		},
		getUsersPanel: function() {
			return $('#shoutbox-users');
		}
	};

	return Base;
});