/* main.js
 * Main functionality for NewsBlur Notifier
 *
 * Written by: Espen Helgedagsrud (kleevah@zawiarr.com)
 * Based on Google Reader Notifier by al007 
 *  (http://addons.opera.com/extensions/details/google-reader-notifier/)
 */

var NEWSBLUR_DOMAIN = "newsblur.com";
var NEWSBLUR_PATH   = "/folder/everything";
var GET_UNREAD_UPDATE = "/reader/refresh_feeds";

var ICON_OK 			= "icons/icon-32.png";
var ICON_NO_AUTH 	= "icons/icon-32-disabled.png"; 


var initialRun = true;
var isAuthenticated = false;
var useDev, useSSH, updateTime;
var updateCountTimer;

var unreadCount = 0;

function init() {
	var ToolbarUIItemProperties = {
		title: "NewsBlur Notifier",
		icon: ICON_OK,
		onclick: function() {
			var oTabs = opera.extension.tabs;
			if(!oTabs) return;
			
			// Do nothing if we already have the correct tab
			if(isTabFocused()) return;
			
			var url = getURL();
			if (isAuthenticated) url += NEWSBLUR_PATH;
			oTabs.create({url: url, focused: true});
		},
		
		badge: {
			display: "block",
			textContent: "",
			color: "white",
			backgroundColor: "#D30004",
		}
	}
	
	// listener for storage events
	function storageHandler(e)
	{
		// check if the storage effected is the widget.preferences
		if( e.storageArea!==widget.preferences ) return;
		var storage = widget.preferences;
		
		if (e.key == "sshcheck") useSSH = (storage[e.key] == "on") ? true:false;
		if (e.key == "devcheck") useDev = (storage[e.key] == "on") ? true:false;
		if (e.key == "updateTime") {
			if (updateTime != storage[e.key]){
				updateTime = storage[e.key];
				clearInterval(updateCountTimer);
				updateCountTimer = setInterval(getUpdateCount, updateTime);
			}
		}
		
	}
	
	button = opera.contexts.toolbar.createItem(ToolbarUIItemProperties);
	opera.contexts.toolbar.addItem(button);

	// listen to storage events, load stored values.
	addEventListener("storage", storageHandler, false);
	useSSH 			= (widget.preferences['sshcheck'] == "on") ? true : false;
	useDev 			= (widget.preferences['devcheck'] == "on") ? true : false;
	updateTime 	= widget.preferences['updateTime'];

	updateCountTimer = setInterval(getUpdateCount, updateTime);
	getUpdateCount();
}

function getUpdateCount(){
	var req = new XMLHttpRequest();
	
	req.open("GET", getURL() + GET_UNREAD_UPDATE, true);
	req.onreadystatechange = function() {
		if ((req.readyState == 4) && (req.status == 200)) {
			var resp = JSON.parse(req.responseText);
			if (resp) {
				
				// Auth check.
				if (resp['authenticated'] != true) {
					isAuthenticated = false;
					button.icon = ICON_NO_AUTH;
					button.title = "Not authenticated, please log in at NewsBlur.com";
					return;
				}
				
				// Change icon if auth is OK.
				if (isAuthenticated == false) {
					isAuthenticated = true;
					button.icon = ICON_OK;
					button.title = "NewsBlur Notifier";
				}
				
				// Check for unread count in returned JSON.
				var nt = 0;
				for (var key in resp.feeds) { 
					if (resp.feeds.hasOwnProperty(key) && (resp.feeds[key].nt)) {
						nt += resp.feeds[key].nt;
					}
				}
				
				// Update button
				unreadCount = nt;
				updateButton();
				
			}
		}
	}
	req.send(null);
}

function isTabFocused() {
	try {
		var tab = opera.extension.tabs.getFocused();
		if (tab.url == NEWSBLUR_FULL_URL)
			return tab;
	} catch (e) {}
	return false;
}

function getURL(){
	var dprefix;
	dprefix  = (useSSH) ? "https://" : "http://";
	dprefix += (useDev) ? "dev." : ""; 
	
	return dprefix + NEWSBLUR_DOMAIN;
}

function updateButton() {
	if (button.badge.textContent != unreadCount) {
		if (unreadCount == 0) {
			button.badge.textContent = "";
		} else {
			var bText = (unreadCount > 999) ? "999+" : unreadCount + "";
			button.badge.textContent = 
				((bText.length <= 2) && (bText.length > 0)) ? " "+bText+" " : bText; 
		}
	}
}
