var _gaq = _gaq || [];

(function(){
    var UPDATE_INTERVAL = 24 * 60 * 60 * 1000; // Update after 24 hours
    var active = true;
    var publishRequested = false;
    var playing = false;
    var clipSelectState = 0;
    var userTimelineInteraction = false;
    
    var PAUSED_MESSAGE = "Paused (spacebar to play)";
    var PLAYING_MESSAGE = "Playing (spacebar to pause)";

    _gaq.push(function() {
        _gaq.push(['_setAccount', 'UA-10393243-10']);
        _gaq.push(['_trackPageview']);
        _gaq.push(['_trackEvent', 'Extension', 'GALoaded']);
    });

    // Retrieve GA from storage
    chrome.storage.local.get({
        lastUpdated: 0,
        code: ''
    }, function(items) {
        if (Date.now() - items.lastUpdated > UPDATE_INTERVAL) {
            // Get updated file, and if found, save it.
            get('https://ssl.google-analytics.com/ga.js', function(code) {
                if (!code) return;
                chrome.storage.local.set({lastUpdated: Date.now(), code: code});
            });
        }
        if (items.code) {// Cached GA is available, use it
            eval_code(items.code);
        } else {// No cached version yet. Load from extension
            get(chrome.extension.getURL('js/ga.js'), eval_code);
       }
    });

    // Typically run within a few milliseconds
    function eval_code(code) {
        try { window.eval(code); } catch (e) { console.error(e); }
    }

    function get(url, callback) {
        var x = new XMLHttpRequest();
        x.onload = x.onerror = function() { callback(x.responseText); };
        x.open('GET', url);
        x.send();
    }
    
    function daemonLoop() {
        if (!active) return;
        
        if (typeof this.preview_swf == "undefined") {
            player = jQuery("#preview-swf")[0];
            if ((typeof player == "object") && 
               ((typeof player.getPlayerState) == "function")) {
                this.preview_swf = player;
            }
        }        
        
        if ((typeof this.preview_swf) == "object" &&
            (typeof this.preview_swf.getPlayerState) == "function" &&
            this.preview_swf.getPlayerState() == 1 &&
            !playing) {
            this.preview_swf.pauseVideo();
        }
        
        //Maintain current timeline position using the pro mode scrubber
        if ( !playing ) {
            var sliderValue = jQuery("#timeline-scrubber").slider('value');
            var timelineWidth = jQuery(".editor-timeline")[0].scrollWidth - jQuery(".editor-timeline")[0].clientWidth;
            var newScroll = Math.round((timelineWidth*sliderValue)/100);
            if ( jQuery(".editor-timeline").scrollLeft() != newScroll) {
                jQuery(".editor-timeline").scrollLeft(newScroll);
            }
        }
    }

    window.setInterval(daemonLoop, 500);
                        
    $("#publish-button").click(function(evt) {
        publishRequested = true; //Leaving the page to publish video
    });
    
    window.onbeforeunload = confirmExit;
    function confirmExit(event) {
        //Don't request confirm if publishing
        if ( publishRequested ) {
            _gaq.push(['_trackEvent', 'Extension', 'PublishExit']);
            return null;
        } else {
            _gaq.push(['_trackEvent', 'Extension', 'ConditionalExit']);
        }
        
        return "There may be unsaved changes. Do you wish to leave the page?";
    }
    
    jQuery("#page").addClass('promode_active');
    function toggleActive() {
        active = !active;

        if ( active ) {
            jQuery("#page").addClass('promode_active');
            jQuery("#timeline-scrubber").show();
        } else {
            jQuery("#page").removeClass('promode_active');
            jQuery("#timeline-scrubber").hide();
        }
    }
    
    //Deactivate hotkeys when focused in text inputs
    jQuery("input[type*=text], textarea").focus(function(evt){
       toggleActive(); 
    });
    jQuery("input[type*=text], textarea").blur(function(evt){
        toggleActive();
    });
    
    //Reset clip select state when clip is clicked
    jQuery(".timeline-video-clip").click(function(evt){
        clipSelectState = 0; 
    });
    
    jQuery(".editor-timeline").scroll(function(evt){
        if ( playing ) {
            updateScrubber();
        }
    });

    $(".editor-timeline").before("<br /><div id='timeline-scrubber'></div>");
    $("#timeline-scrubber").slider({
        min: 0, 
        max: 100,
        step: .01,
        slide: handleScrub
    });
    
    //Set size of the scrubber handler
    $('.ui-slider-handle').height(30);
    $('.ui-slider-handle').width(30);
    
    function handleScrub(evt, ui) {
        var value = ui.value;
        var timelineWidth = jQuery(".editor-timeline")[0].scrollWidth - jQuery(".editor-timeline")[0].clientWidth;
        jQuery(".editor-timeline").scrollLeft(Math.round((timelineWidth*value)/100));
    }
        
    function updateScrubber() {
        var timelineScroll = jQuery(".editor-timeline").scrollLeft();
        var timelineWidth = jQuery(".editor-timeline")[0].scrollWidth - jQuery(".editor-timeline")[0].clientWidth;
        $("#timeline-scrubber").slider('value', Math.round(10000 * timelineScroll/timelineWidth)/100);
    }
    
    $("#save-changes-message").after(" <span id='play-state-msg' class='play-state-paused'>" + PAUSED_MESSAGE + "</span>");
    
    //Handle scroll right / left with arrow keys
    jQuery(document).keydown(function(evt){
        if ( evt.which == 39 ) { //scrub right
            var timelineWidth = jQuery(".editor-timeline")[0].scrollWidth - jQuery(".editor-timeline")[0].clientWidth;
            var timelineScroll = jQuery(".editor-timeline").scrollLeft();
            timelineScroll = timelineScroll + .1 * timelineWidth;
            if ( timelineScroll > timelineWidth ) {
                timelineScroll = timelineWidth;
            }
            jQuery(".editor-timeline").scrollLeft(timelineScroll);
            updateScrubber();
        } else if ( evt.which == 37 ) { //scrub left
            var timelineWidth = jQuery(".editor-timeline")[0].scrollWidth - jQuery(".editor-timeline")[0].clientWidth;
            var timelineScroll = jQuery(".editor-timeline").scrollLeft();
            timelineScroll = timelineScroll - .1 * timelineWidth;
            if ( timelineScroll < 0 ) {
                timelineScroll = 0;
            }
            jQuery(".editor-timeline").scrollLeft(timelineScroll);
            updateScrubber();
        }
    });

    
    //Modal Help Screen
    $("body").append('<div id="yteditorpro_help" class="modal fade">' +
      '<div class="modal-dialog">' +
        '<div class="modal-content">' +
          '<div class="modal-header">' +
            '<button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>' +
            '<h4 class="modal-title"><b>Pro Mode for Youtube Video Editor - Help</b></h4>' +
          '</div>' +
          '<div class="modal-body">' +
            '<table class="help">' +
                '<tr><td>' + 'H</td><td>Show / Hide this help screen' + '</td></tr>' +
                '<tr><td>' + 'CTRL-A</td><td>Toggle pro mode hotkeys on/off' + '</td></tr>' +
                '<tr><td>' + 'S</td><td>Sort photos alphabetically on the images tab' + '</td></tr>' +
                '<tr><td>' + 'C</td><td>Close the currently selected clip' + '</td></tr>' +
                '<tr><td>' + 'K</td><td>Toggle Pan / Zoom effect on currently selected clip' + '</td></tr>' +
                '<tr><td>' + '+</td><td>Increase currently selected clip by 1 second' + '</td></tr>' +
                '<tr><td>' + '-</td><td>Decrease currently selected clip by 1 second' + '</td></tr>' +
                '<tr><td>' + 'P</td><td>Scroll timeline to currently selected clip. Toggle start/end of clip by pressing repeatedly.' + '</td></tr>' +
                '<tr><td>' + '[</td><td>Scroll timeline to first clip' + '</td></tr>' +
                '<tr><td>' + ']</td><td>Scroll timeline to last clip' + '</td></tr>' +
                '<tr><td>' + '.</td><td>Select next clip' + '</td></tr>' +
                '<tr><td>' + ',</td><td>Select previous clip' + '</td></tr>' +
                '<tr><td>' + '1</td><td>Video clip tab' + '</td></tr>' +
                '<tr><td>' + '2</td><td>Copyright tab' + '</td></tr>' +
                '<tr><td>' + '3</td><td>Photos tab' + '</td></tr>' +
                '<tr><td>' + '4</td><td>Audio tab' + '</td></tr>' +
                '<tr><td>' + '5</td><td>Transitions tab' + '</td></tr>' +
                '<tr><td>' + '6</td><td>Text tab' + '</td></tr>' +
                '<tr><td>' + 'Right arrow</td><td>Scroll timeline right' + '</td></tr>' +
                '<tr><td>' + 'Left arrow</td><td>Scroll timeline left' + '</td></tr>' +
            '</table>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>');
    $("#yteditorpro_help").modal({'show':false});
    
    /* center modal - http://www.minimit.com/articles/solutions-tutorials/vertical-center-bootstrap-3-modals */
    function centerModals(){
      $('.modal').each(function(i){
        var $clone = $(this).clone().css('display', 'block').appendTo('body');
        var top = Math.round(($clone.height() - $clone.find('.modal-content').height()) / 2);
        top = top > 0 ? top : 0;
        $clone.remove();
        $(this).find('.modal-content').css("margin-top", top);
      });
    }
    $('.modal').on('show.bs.modal', centerModals);
    $(window).on('resize', centerModals);
    
    //Hotkeys
    jQuery(document).keypress(
        function(event) {
            if ( event.which == 1 ) { //CTRL-A
                _gaq.push(['_trackEvent', 'Hotkey', 'ToggleActive']);
                toggleActive();
            }

            if ( active ) {
                if ( event.which == 99 ) { //C - Close current window
                    _gaq.push(['_trackEvent', 'Hotkey', 'CloseWindow']);
                    jQuery(".close-button")[0].click();
                    jQuery(".close-button")[1].click();
                } else if ( event.which == 32 ) { //Spacebar - Pause/Play video
                    _gaq.push(['_trackEvent', 'Hotkey', 'PausePlay']);
                    event.preventDefault();
                    var player = jQuery("#preview-swf")[0];

                    if (player.getPlayerState() == 1) {
                        playing = false;
                        player.pauseVideo();
                        $("#timeline-scrubber").slider('enable');
                        $("#play-state-msg").text(PAUSED_MESSAGE);
                        $("#play-state-msg").toggleClass('play-state-paused');
                        $("#play-state-msg").toggleClass('play-state-playing');
                    } else {
                        playing = true;
                        player.playVideo();
                        $("#timeline-scrubber").slider('disable');
                        $("#play-state-msg").text(PLAYING_MESSAGE);
                        $("#play-state-msg").toggleClass('play-state-paused');
                        $("#play-state-msg").toggleClass('play-state-playing');
                    }
                } else if ( event.which == 115 ) { //S - sort thumbnails
                    _gaq.push(['_trackEvent', 'Hotkey', 'SortThumbnails']);
                    if ( jQuery("#images-tab").attr('class').indexOf('selected') != -1 ) {
                        var parent = jQuery(jQuery(".image-original")[0]).parent();
                        var images = jQuery(".image-original").detach();
                        images.sort(function(a,b){
                            var urlA = jQuery(a).find("img").css('background-image');
                            urlA = urlA.substring(urlA.lastIndexOf('/')+1);
                            var urlB = jQuery(b).find("img").css('background-image');
                            urlB = urlB.substring(urlB.lastIndexOf('/')+1);
                            return urlA.localeCompare(urlB);
                        });
                        images.appendTo(parent);
                    }
                } else if ( event.which == 107) { //K - ken burns effect
                    _gaq.push(['_trackEvent', 'Hotkey', 'KenBurns']);
                    jQuery("input[effectid*='KEN_BURNS']").click();
                } else if ( event.which == 43) { //+ key increase by one second selected clip
                    _gaq.push(['_trackEvent', 'Hotkey', 'Increase1S']);
                    jQuery(".right-trimmer").each(function(idx,val) {
                        var target = jQuery(val);
                        if (target.css("visibility") == "visible") {
                            for ( var i = 0; i < 15; i++ ) {
                                target.find(".nudge-right").click();
                            }                                
                        }
                    });
                } else if ( event.which == 45) { //- key decrease by one second selected clip
                    _gaq.push(['_trackEvent', 'Hotkey', 'Decrease1S']);
                    jQuery(".right-trimmer").each(function(idx,val) {
                        var target = jQuery(val);
                        if (target.css("visibility") == "visible") {
                            for ( var i = 0; i < 15; i++ ) {
                                target.find(".nudge-left").click();
                            }
                        }
                    });
                } else if ( event.which == 49) { //1 - video tab
                    _gaq.push(['_trackEvent', 'Hotkey', 'VideoTab']);
                    if (jQuery("#mediapicker-infobox").attr('class') == "infobox-visible") {
                        jQuery("#mediapicker-infobox").toggleClass("mediapicker-visible");
                        jQuery("#mediapicker-infobox").toggleClass("infobox-visible");
                    }
                    jQuery("#video-tab").click();
                } else if ( event.which == 50) { //2 - copyright tab
                    _gaq.push(['_trackEvent', 'Hotkey', 'CopyrightTab']);
                    if (jQuery("#mediapicker-infobox").attr('class') == "infobox-visible") {
                        jQuery("#mediapicker-infobox").toggleClass("mediapicker-visible");
                        jQuery("#mediapicker-infobox").toggleClass("infobox-visible");
                    }
                    jQuery("#cc-tab").click();                    
                } else if ( event.which == 51) { //3 images tab
                    _gaq.push(['_trackEvent', 'Hotkey', 'ImagesTab']);
                    if (jQuery("#mediapicker-infobox").attr('class') == "infobox-visible") {
                        jQuery("#mediapicker-infobox").toggleClass("mediapicker-visible");
                        jQuery("#mediapicker-infobox").toggleClass("infobox-visible");
                    }
                    jQuery("#images-tab").click();
                } else if ( event.which == 52) { //4 audio tab
                    _gaq.push(['_trackEvent', 'Hotkey', 'AudioTab']);
                    if (jQuery("#mediapicker-infobox").attr('class') == "infobox-visible") {
                        jQuery("#mediapicker-infobox").toggleClass("mediapicker-visible");
                        jQuery("#mediapicker-infobox").toggleClass("infobox-visible");
                    }
                    jQuery("#audio-tab").click();
                } else if ( event.which == 53) { //5 transitions tab
                    _gaq.push(['_trackEvent', 'Hotkey', 'VideoTab']);
                    if (jQuery("#mediapicker-infobox").attr('class') == "infobox-visible") {
                        jQuery("#mediapicker-infobox").toggleClass("mediapicker-visible");
                        jQuery("#mediapicker-infobox").toggleClass("infobox-visible");
                    }
                    jQuery("#transition-tab").click();
                } else if ( event.which == 54) { //6 text tab
                    _gaq.push(['_trackEvent', 'Hotkey', 'TextTab']);
                    if (jQuery("#mediapicker-infobox").attr('class') == "infobox-visible") {
                        jQuery("#mediapicker-infobox").toggleClass("mediapicker-visible");
                        jQuery("#mediapicker-infobox").toggleClass("infobox-visible");
                    }
                    jQuery("#text-tab").click();
                } else if ( event.which == 112 ) { //P - focus current clip
                    _gaq.push(['_trackEvent', 'Hotkey', 'FocusCurrent']);
                    
                    var offset = jQuery(".timeline-video-clips").children(".selected").css('left');
                    if ( offset != undefined ) {
                        if ( clipSelectState == 0 ) {
                            //Scroll to start of clip
                            jQuery(".editor-timeline").scrollLeft(parseInt(offset.substring(0,offset.lastIndexOf("px"))));
                            clipSelectState = 1;
                        } else if ( clipSelectState == 1 ) {
                            //Scroll to end of clip
                            var width = jQuery(".timeline-video-clips").children(".selected").width();
                            jQuery(".editor-timeline").scrollLeft(parseInt(offset.substring(0,offset.lastIndexOf("px"))) + width);
                            clipSelectState = 0;
                        }
                    }
                    updateScrubber();
                } else if ( event.which == 91 ) { // [ - focus start
                    _gaq.push(['_trackEvent', 'Hotkey', 'FocusStart']);
                    jQuery(".editor-timeline").scrollLeft(0);
                    updateScrubber();
                } else if ( event.which == 93 ) { // ] - focus end
                    _gaq.push(['_trackEvent', 'Hotkey', 'FocusEnd']);
                    var offset = jQuery(".timeline-video-clips").children().last().css('left');
                    jQuery(".editor-timeline").scrollLeft(offset.substring(0,offset.lastIndexOf("px")));
                    updateScrubber();
                } else if ( event.which == 104 ) { // H - show help
                    _gaq.push(['_trackEvent', 'Hotkey', 'ToggleHelp']);
                    $("#yteditorpro_help").modal('toggle');
                } else if ( event.which == 46 ) { // . - next clip in timeline
                    _gaq.push(['_trackEvent', 'Hotkey', 'NextClip']);
                    
                    var nextClip = jQuery(".timeline-video-clips").children(".selected").next();
                    
                    if ( nextClip != undefined ) {
                        nextClip.click();
                        var offset = nextClip.css('left');
                        jQuery(".editor-timeline").scrollLeft(parseInt(offset.substring(0,offset.lastIndexOf("px"))));
                    }
                    
                    updateScrubber();
                } else if ( event.which == 44 ) { // , - previous clip in timeline
                    _gaq.push(['_trackEvent', 'Hotkey', 'PrevClip']);
                    
                    var prevClip = jQuery(".timeline-video-clips").children(".selected").prev();
                    
                    if ( prevClip != undefined ) {
                        prevClip.click();
                        var offset = prevClip.css('left');
                        jQuery(".editor-timeline").scrollLeft(parseInt(offset.substring(0,offset.lastIndexOf("px"))));
                    }
                    
                    updateScrubber();
                }
            } 
        }
    );
})();