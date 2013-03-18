/* main.js
 * Main functionality for NewsBlur Notifier
 *
 * Written by: Espen Helgedagsrud (kleevah@zawiarr.com)
 * Based on Google Reader Notifier by al007 
 *  (http://addons.opera.com/extensions/details/google-reader-notifier/)
 */

var NEWSBLUR_DOMAIN   = "newsblur.com";
var NEWSBLUR_PATH     = "/folder/everything";
var GET_UNREAD_UPDATE = "/reader/refresh_feeds";

var TITLE_REGEX = /\((\d+)\)\sNewsBlur/g;
var TITLE_UPDATE_FREQ = 1000; // We check title every second

var ICON_OK 			= "icons/icon-32.png";
var ICON_NO_AUTH 	= "icons/icon-32-disabled.png";

var initialRun = true;
var isAuthenticated = false;
var useDev, useSSH, updateTime;
var updateCountTimer, titleUpdateTimer;

var titleFailCount = 0;
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
      
      // This will update the unread count from the tab itself as long as 
      // it is focused.
      clearInterval(titleUpdateTimer);
      titleUpdateTimer = setInterval(getTitleCount, TITLE_UPDATE_FREQ);
    },
    
    badge: {
      display: "block",
      textContent: "",
      color: "white",
      backgroundColor: "#D30004",
    }
  }
  
  // Listener for storage events
  function storageHandler(e) {
    // Check if the storage effected is the widget.preferences
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

  // Listen to storage events, load stored values.
  addEventListener("storage", storageHandler, false);
  useSSH 			= (widget.preferences['sshcheck'] == "on") ? true : false;
  useDev 			= (widget.preferences['devcheck'] == "on") ? true : false;
  updateTime 	= widget.preferences['updateTime'];

  // Start JSON updater.
  updateCountTimer = setInterval(getUpdateCount, updateTime);
  getUpdateCount();
}


// Fetch the unread count from the NewsBlur API using JSON.
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


// Get the unread count directly from the tab title if focused.
function getTitleCount(){
  var tab = isTabFocused();
  if (tab) {
    var tabcount = TITLE_REGEX.exec(tab.title);
    if (tabcount && tabcount[1]){
      console.log("TITLEMATCH: " + tabcount[1] );
      unreadCount = tabcount[1];
      updateButton();
    }
    
  } else { 
    // Stop polling title if it fails 5 times (5 * TITLE_UPDATE_FREQ).
    if (++titleFailCount >= 5){
      titleFailCount = 0;
      clearInterval(titleUpdateTimer);
    }
  }
}


// Check if focused tab is NewsBlur. 
function isTabFocused() {
  try {
    var tab = opera.extension.tabs.getFocused();
    if (tab.url == getURL() + NEWSBLUR_PATH)
      return tab;
  } catch (e) {}
  return false;
}


// Returns the URL for NewsBlur with proper prefix.
function getURL(){
  var dprefix;
  dprefix  = (useSSH) ? "https://" : "http://";
  dprefix += (useDev) ? "dev." : ""; 
  
  return dprefix + NEWSBLUR_DOMAIN;
}


// Update the button badge with current unread count.
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
