var async = require('async'),
	db = module.parent.parent.parent.require('./database'),
	User = module.parent.parent.parent.require('./user'),
	Plugins = module.parent.parent.parent.require('./plugins');
	//Ye this needs something better

Backend = {
	"addShout": function(fromuid, content, callback) {
		db.incrObjectField('global', 'nextSid', function(err, sid) {
			if (err) {
				return callback(err, null);
			}

			var shout = {
				content: content,
				timestamp: Date.now(),
				fromuid: fromuid,
				deleted: '0'
			};

			db.setObject('shout:' + sid, shout);
			db.listAppend('shouts', sid);

			Backend.updateShoutTime(fromuid);
			shout.sid = sid;
			callback(null, shout);
		});
	},
	"getShout": function(sid, callback) {
		db.getObject('shout:' + sid, function(err, shout) {
			if (err) {
				return callback(err);
			}
			return callback(null, shout);
		});
	},
	"getShouts": function(start, end, callback) {
		db.getListRange('shouts', start, end, function(err, sids) {
			if (err) {
				return callback(err, null);
			}

			if (!sids || !sids.length) {
				return callback(null, []);
			}

			function getShout(sid, next) {
				db.getObject('shout:' + sid, function(err, message) {
					if (err) {
						return next(err);
					}
					if (message.deleted === '1') {
						return next(null);
					}
					User.getMultipleUserFields([message.fromuid], ['username', 'picture', 'userslug'], function(err, userData) {
						userData = userData[0];
						userData.uid = message.fromuid;
						Backend.parse(message.content, userData, false, function(err, parsed) {
							message.content = parsed;
							message.sid = sid;
							next(null, message);
						});
					});
				});
			}

			async.map(sids, getShout, callback);
		});
	},
	"parse": function(message, userData, isNew, callback) {
		Plugins.fireHook('filter:post.parse', message, function(err, parsed) {
			User.isAdministrator(userData.uid, function(err, isAdmin) {
				var username,
					picture,
					content,
					userclass = "shoutbox-user";

				if (isAdmin) {
					userclass += " shoutbox-user-admin";
				}

				username = '<a href="/user/' + userData.userslug + '" ' +
					'class="' + userclass + '">' + userData.username + '</a>: ';
				picture = '<img class="shoutbox-user-image" src="' + userData.picture + '">';
				content = '<span class="shoutbox-shout-message">' + parsed + '</span>';

				var shoutData = {
					message: message,
					parsed: parsed,
					fromuid: userData.uid,
					myuid: userData.uid,
					toUserData: userData,
					myUserData: userData,
					isNew: isNew,
					parsedMessage: picture + username + content
				};

				Plugins.fireHook('filter:messaging.parse', shoutData, function(err, messageData) {
					callback(null, messageData.parsedMessage);
				});
			});
		});
	},
	"removeShout": function(sid, uid, callback) {
		User.isAdministrator(uid, function(err, isAdmin) {
			db.getObjectField('shout:' + sid, 'fromuid', function(err, fromuid) {
				if (err) {
					return callback("Unknown error", false);
				}
				if (fromuid === uid || isAdmin) {
					db.setObjectField('shout:' + sid, 'deleted', '1', function (err, result) {
						if (err) {
							return callback("Unknown error", false);
						}
						return callback(null, true);
					});
				} else {
					return callback("Shout does not belong to you", false);
				}
			});
		});
	},
	"editShout": function(sid, msg, uid, username, callback) {
		User.isAdministrator(uid, function(err, isAdmin) {
			db.getObjectField('shout:' + sid, 'fromuid', function(err, fromuid) {
				if (err) {
					return callback("Unknown error", false);
				}
				if (fromuid === uid || isAdmin) {
					db.setObjectField('shout:' + sid, 'content', msg, function (err, result) {
						if (err) {
							return callback("Unknown error", false);
						}
						User.getMultipleUserFields([fromuid], ['username', 'picture', 'userslug'], function(err, userData) {
							userData = userData[0];
							userData.uid = fromuid;
							Backend.parse(msg, userData, false, function(err, result) {
								return callback(null, result);
							});
						});
					});
				} else {
					return callback("Shout does not belong to you", false);
				}
			});
		});
	},
	"pruneDeleted": function(uid, callback) {
		User.isAdministrator(uid, function(err, isAdmin) {
			if (isAdmin === true) {
				db.getListRange('shouts', 0, -1, function(err, sids) {
					if (err || !sids || !sids.length) {
						return callback(err, false);
					}

					function deleteShout(sid, next) {
						db.getObjectField('shout:' + sid, 'deleted', function(err, isDeleted) {
							if (isDeleted === '1') {
								db.delete('shout:' + sid);
								db.listRemoveAll('shouts', sid);
								next()
							}
							next(null);
						});
					}

					async.map(sids, deleteShout, function(err) {
						if (err) {
							return callback(err, false);
						}
						return callback(null, true);
					});
				});
			} else {
				return callback("Not allowed", false);
			}
		});
	},
	"removeAll": function(uid, callback) {
		User.isAdministrator(uid, function(err, isAdmin) {
			if (isAdmin === true) {
				db.getListRange('shouts', 0, -1, function(err, sids) {
					if (err || !sids || !sids.length) {
						return callback(err, false);
					}

					function deleteShout(sid, next) {
						db.delete('shout:' + sid);
						db.listRemoveAll('shouts', sid);
						next();
					}

					async.eachSeries(sids, deleteShout, function(err) {
						db.setObjectField('global', 'nextSid', 0, function(err, result) {
							if (err) {
								return callback(err, null);
							}
							return callback(null, true);
						});
					});
				});
			} else {
				return callback("Not allowed", false);
			}
		});
	},
	"updateShoutTime": function(uid, callback) {
		db.sortedSetAdd('uid:' + uid + ':shouts', Date.now(), 0, function(err) {
			if (callback) {
				callback(err);
			}
		});
	}
}

module.exports = Backend;