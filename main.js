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

var TITLE_REGEX_SINGLE = /\((\d+)\)\sNewsBlur/g;
var TITLE_REGEX_DOUBLE = /\((\d+)\/(\d+)\)\sNewsBlur/g;
var TITLE_UPDATE_FREQ = 1000; // We check title every second

var ICON_OK       = "icons/icon-32.png";
var ICON_NO_AUTH  = "icons/icon-32-disabled.png";

var COLOR_UNREAD  = "#D30004"; 
var COLOR_FOCUSED = "#6EA74A";

var initialRun = true;
var isAuthenticated = false;
var useDev, useSSL, updateTime, styleType;
var updateCountTimer, titleUpdateTimer;

var titleFailCount = 0;
var unreadPs = 0; // Unread counters for focused (ps) and normal (nt).
var unreadNt = 0;

function init() {
  var ToolbarUIItemProperties = {
    title: "NewsBlur Notifier",
    icon: ICON_OK,
    onclick: function() {
      var oTabs = opera.extension.tabs;
      if(!oTabs) return;
      
      // If current tab is not newsblur we open a new one.
      if(!isTabFocused()) {
        var url = getURL();
        if (isAuthenticated) url += NEWSBLUR_PATH;
        oTabs.create({url: url, focused: true});
      }
      
      // This will try to update the unread count from the tab itself as 
      // long as it is focused.
      clearInterval(titleUpdateTimer);
      titleUpdateTimer = setInterval(getTitleCount, TITLE_UPDATE_FREQ);
      
    },
    
    badge: {
      display: "block",
      textContent: "",
      color: "white",
      backgroundColor: COLOR_UNREAD,
    }
  }
  
  // Listener for storage events
  function storageHandler(e) {
    // Check if the storage effected is the widget.preferences
    if( e.storageArea!==widget.preferences ) return;
    var storage = widget.preferences;
    
    if (e.key == "sslcheck") useSSL = (storage[e.key] == "on") ? true:false;
    if (e.key == "devcheck") useDev = (storage[e.key] == "on") ? true:false;
    if (e.key == "updateTime") {
      if (updateTime != storage[e.key]){
        updateTime = storage[e.key];
        clearInterval(updateCountTimer);
        updateCountTimer = setInterval(getUpdateCount, updateTime);
      }
    }
    if (e.key == "styleType") {
      styleType = storage[e.key];
      button.badge.backgroundColor = 
        (styleType == "s3") ? COLOR_FOCUSED : COLOR_UNREAD;
      updateButton();
    }
  }
  
  button = opera.contexts.toolbar.createItem(ToolbarUIItemProperties);
  opera.contexts.toolbar.addItem(button);

  // Listen to storage events, load stored values.
  addEventListener("storage", storageHandler, false);
  useSSL      = (widget.preferences['sslcheck'] == "on") ? true : false;
  useDev      = (widget.preferences['devcheck'] == "on") ? true : false;
  updateTime  = widget.preferences['updateTime'];
  styleType   = widget.preferences['styleType'];
  button.badge.backgroundColor = 
    (styleType == "s3") ? COLOR_FOCUSED : COLOR_UNREAD;
  
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
        var ps = 0, nt = 0;
        for (var key in resp.feeds) { 
          if (resp.feeds.hasOwnProperty(key)){
            if (resp.feeds[key].ps) ps += resp.feeds[key].ps;
            if (resp.feeds[key].nt) nt += resp.feeds[key].nt;
          }
        }
        
        // Update button
        unreadPs = ps;
        unreadNt = nt;
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
    var tabcount_single = TITLE_REGEX_SINGLE.exec(tab.title);
    var tabcount_double = TITLE_REGEX_DOUBLE.exec(tab.title);
    
    if (tabcount_double && tabcount_double[1] && tabcount_double[2]){
      unreadNt = tabcount_double[1];
      unreadPs = tabcount_double[2];
      updateButton();
      
    } else if (tabcount_single && tabcount_single[1]) {
      unreadNt = tabcount_single[1];
      unreadPs = 0;
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
    if (tab.url.indexOf(getURL()) != -1)
      return tab;
  } catch (e) {}
  return false;
}


// Returns the URL for NewsBlur with proper prefix.
function getURL(){
  var dprefix;
  dprefix  = (useSSL) ? "https://" : "http://";
  dprefix += (useDev) ? "dev." : ""; 
  
  return dprefix + NEWSBLUR_DOMAIN;
}


// Update the button badge with current unread count.
function updateButton() {

  if (styleType == "s1" || styleType == "s3") { // Total unread + only focus
    var totCount = parseInt(unreadNt) + parseInt(unreadPs);
    var displayCount = (styleType == "s1") ?  totCount : parseInt(unreadPs);
    
    if (button.badge.textContent != displayCount) {
      if (displayCount == 0) {
        button.badge.textContent = "";
      } else {
        var bText = (displayCount > 999) ? "999+" : displayCount + "";
        button.badge.textContent = 
          ((bText.length <= 2) && (bText.length > 0)) 
            ? " "+bText+" " : bText; 
      }
    }
    
  } else if (styleType == "s2") { // Separate counts
    var dispNt = (parseInt(unreadNt) > 99) ? "++" : unreadNt;
    var dispPs = (parseInt(unreadPs) > 99) ? "++" : unreadPs;
    var displayStr = " " + dispNt + "/" + dispPs + " "; 
    
    button.badge.textContent = displayStr;
  }

}
