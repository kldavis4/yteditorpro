var _gaq = _gaq || [];

(function(){
    var UPDATE_INTERVAL = 24 * 60 * 60 * 1000; // Update after 24 hours
    var active = true;
    var publishRequested = false;
    var playing = false;
    var clipSelectState = 0;
    var initialized = false;
    var duration = 0;
    var working = false;
    var self = this;

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

    //Event simulation
    //http://stackoverflow.com/a/6158050/290918
    //
    function simulate(element, eventName)
    {
        var options = extend(defaultOptions, arguments[2] || {});
        var oEvent, eventType = null;

        for (var name in eventMatchers)
        {
            if (eventMatchers[name].test(eventName)) { eventType = name; break; }
        }

        if (!eventType)
            throw new SyntaxError('Only HTMLEvents and MouseEvents interfaces are supported');

        if (document.createEvent)
        {
            oEvent = document.createEvent(eventType);
            if (eventType == 'HTMLEvents')
            {
                oEvent.initEvent(eventName, options.bubbles, options.cancelable);
            }
            else
            {
                oEvent.initMouseEvent(eventName, options.bubbles, options.cancelable, document.defaultView,
                options.button, options.pointerX, options.pointerY, options.pointerX, options.pointerY,
                options.ctrlKey, options.altKey, options.shiftKey, options.metaKey, options.button, element);
            }
            element.dispatchEvent(oEvent);
        }
        else
        {
            options.clientX = options.pointerX;
            options.clientY = options.pointerY;
            var evt = document.createEventObject();
            oEvent = extend(evt, options);
            element.fireEvent('on' + eventName, oEvent);
        }
        return element;
    }

    function extend(destination, source) {
        for (var property in source)
          destination[property] = source[property];
        return destination;
    }

    var eventMatchers = {
        'HTMLEvents': /^(?:load|unload|abort|error|select|change|submit|reset|focus|blur|resize|scroll)$/,
        'MouseEvents': /^(?:click|dblclick|mouse(?:down|up|over|move|out))$/
    }
    var defaultOptions = {
        pointerX: 0,
        pointerY: 0,
        button: 0,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        metaKey: false,
        bubbles: true,
        cancelable: true
    }

    //Receives for messages for swf player events
    window.addEventListener("message", function(event) {
        if (!active) return;

        switch(event.data.type) {
            case 'yteditorpro_onStateChange':
                if ( event.data.data === 1 && !playing ) {
                    preview_swf.pauseVideo();
                }
                //update the duration
                duration = preview_swf.getDuration();
                setWorking(false);
                break;
        }
    });

    function setupPlayer(player) {
        if (player) {
            this.preview_swf = player;

            //Inject a function into the top-level page to proxy messages from the video player
            var script = document.createElement('script');
            script.innerHTML = 'var yteditorpro_onStateChange = function(data) { window.postMessage({ type: "yteditorpro_onStateChange", data: data }, "*"); };'
            document.getElementById('body').appendChild(script);

            //Add event listener to player swf for state changes
            this.preview_swf.addEventListener("onStateChange","yteditorpro_onStateChange");;
        }

        initialized = true;
    }

    function initialize() {
        var player = jQuery("#preview-swf")[0];
        var playerType = (typeof player);
        if ((playerType === "function" || playerType === "object") &&
            (typeof player.getPlayerState === "function")) {
            setupPlayer(player);
        }

        //Try again in 1 second if initialization didn't occur
        if(!initialized) {
            setTimeout(initialize, 1000);
        }
    }

    function updateTimelineScrollbar() {
        if ( !active || playing ) {
            jQuery(".editor-timeline").css('overflow-x', 'scroll');
        } else {
            //Hide the timeline scrollbar
            jQuery(".editor-timeline").css('overflow-x', 'hidden');

            //Prevent the scrollbar on the timeline from being moved separately from the scrubber
            var sliderValue = jQuery("#timeline-scrubber").slider('value');
            var timelineWidth = jQuery(".editor-timeline")[0].scrollWidth - jQuery(".editor-timeline")[0].clientWidth;
            var newScroll = Math.round((timelineWidth*sliderValue)/100);
            if ( jQuery(".editor-timeline").scrollLeft() != newScroll) {
                jQuery(".editor-timeline").scrollLeft(newScroll);
            }
        }
    }

    //Update the timeline scrollbar on every scroll to lock it in place
    jQuery(".editor-timeline").scroll(function(evt) {
        updateTimelineScrollbar();
    });

    updateTimelineScrollbar();
    initialize();

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

        updateTimelineScrollbar();
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

    //$(".editor-timeline").before("<br /><div id='playpause'>PLAY</div><div id='timeline-scrubber'></div><br />");
    $("#storyboard").before("<br /><table id='controls_table'><tr><td><div id='pauseplay_button' class='playbutton'></div></td><td id='td_scrubber'><div id='timeline-scrubber'></div></td></tr></table>");
    $("#pauseplay_button").click(function(evt) {
        togglePlay();
    });

    $("#timeline-scrubber").slider({
        min: 0,
        max: 100,
        step: .01,
        slide: handleScrub
    });

    //Set size of the scrubber handler
    $('.ui-slider-handle').height(25);
    $('.ui-slider-handle').width(25);

    function isClipSelected() {
        return jQuery(".timeline-video-clips").children(".selected").length > 0;
    }

    function handleScrub(evt, ui) {
        var value = ui.value;
        var timelineWidth = jQuery(".editor-timeline")[0].scrollWidth - jQuery(".editor-timeline")[0].clientWidth;
        jQuery(".editor-timeline").scrollLeft(Math.round((timelineWidth*value)/100));

        if ( !isClipSelected() ) {
            //Seek the playhead based on the scrubber position
            preview_swf.seekTo((duration*value)/100);
        }
    }

    function updateScrubber() {
        var timelineScroll = jQuery(".editor-timeline").scrollLeft();
        var timelineWidth = jQuery(".editor-timeline")[0].scrollWidth - jQuery(".editor-timeline")[0].clientWidth;

        $("#timeline-scrubber").slider('value', Math.round(10000 * timelineScroll/timelineWidth)/100);
    }

    function togglePlay() {
        var player = jQuery("#preview-swf")[0];

        if (player.getPlayerState() == 1) {
            playing = false;
            player.pauseVideo();
            $("#timeline-scrubber").slider('enable');
            $("#play-state-msg").text(PAUSED_MESSAGE);
            $("#play-state-msg").toggleClass('play-state-paused');
            $("#play-state-msg").toggleClass('play-state-playing');
            $("#pauseplay_button").toggleClass('pausebutton');
            $("#pauseplay_button").toggleClass('playbutton');
        } else {
            playing = true;
            player.playVideo();
            $("#timeline-scrubber").slider('disable');
            $("#play-state-msg").text(PLAYING_MESSAGE);
            $("#play-state-msg").toggleClass('play-state-paused');
            $("#play-state-msg").toggleClass('play-state-playing');
            $("#pauseplay_button").toggleClass('pausebutton');
            $("#pauseplay_button").toggleClass('playbutton');
        }

        updateTimelineScrollbar();
    }

    function setWorking(working) {
        self.working = working;
    }

    function parseClipTime(time) {
        var parts = time.split(":");
        var mins = parts[0];
        var secs = parts[1];
        if (mins.length === 1) {
            mins = "0" + mins;
        }

        if ( mins.length !== 2 && secs.length >= 2 ) {
            throw new Error('Invalid clip time format: ' + time);
        }

        return Date.parse("01/01/01 00:" + mins + ":" + secs);
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
            '<br />Watch the <a href="https://www.youtube.com/watch?v=5FshFrRcFrw" target="_blank">demo</a>' +
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

                    togglePlay();
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

                    var handle = jQuery(".timeline-video-clips").children(".selected").find(".right-trimmer").find(".knurling-area");
                    if ( handle && handle.length > 0 ) {
                        var timeSpan = jQuery(".timeline-video-clips").children(".selected").find(".editor-thumb-time");
                        if (timeSpan && timeSpan.length > 0) {
                            var startTime = parseClipTime(timeSpan[0].textContent);
                            var moveX = 0;
                            simulate(handle[0], "mousedown", { pointerX: moveX, pointerY: 0 });
                            while (true) {
                                moveX += 1;
                                simulate(handle[0], "mousemove", { pointerX: moveX, pointerY: 0 });
                                if ((parseClipTime(timeSpan[0].textContent) - startTime)>= 1000 || moveX > 1000) {
                                    break;
                                }
                            }
                            simulate(handle[0], "mouseup");
                        }
                    }
                } else if ( event.which == 45) { //- key decrease by one second selected clip
                    _gaq.push(['_trackEvent', 'Hotkey', 'Decrease1S']);
                    var handle = jQuery(".timeline-video-clips").children(".selected").find(".right-trimmer").find(".knurling-area");
                    if ( handle && handle.length > 0 ) {
                        var timeSpan = jQuery(".timeline-video-clips").children(".selected").find(".editor-thumb-time");
                        if (timeSpan && timeSpan.length > 0) {
                            var currentTimeLabel = timeSpan[0].textContent;
                            if ( currentTimeLabel !== "0:01" && currentTimeLabel !== "0:00" ) {
                                var startTime = parseClipTime(currentTimeLabel);
                                var moveX = 1000;
                                simulate(handle[0], "mousedown", { pointerX: moveX, pointerY: 0 });
                                while (true) {
                                    moveX -= 1;
                                    simulate(handle[0], "mousemove", { pointerX: moveX, pointerY: 0 });
                                    if ((startTime - parseClipTime(timeSpan[0].textContent)) >= 1000 || moveX <= 0) {
                                        break;
                                    }
                                }
                                simulate(handle[0], "mouseup");
                            }
                        }
                    }
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
                    if ( offset ) {
                        if ( clipSelectState === 0 ) {
                            //Scroll to start of clip
                            jQuery(".editor-timeline").scrollLeft(parseInt(offset.substring(0,offset.lastIndexOf("px"))));
                            clipSelectState = 1;
                        } else if ( clipSelectState === 1 ) {
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

                    var nextClip = undefined;
                    if ( jQuery(".timeline-video-clips").children(".selected").length === 0 ) {
                        if (jQuery(".timeline-video-clips").children().length > 0) {
                            nextClip = jQuery(".timeline-video-clips").children().first();
                        }
                    } else {
                        nextClip = jQuery(".timeline-video-clips").children(".selected").next();
                    }

                    if ( nextClip ) {
                        nextClip.click();
                        var offset = nextClip.css('left');
                        if ( offset ) {
                            jQuery(".editor-timeline").scrollLeft(parseInt(offset.substring(0,offset.lastIndexOf("px"))));
                        }
                    }

                    updateScrubber();
                } else if ( event.which == 44 ) { // , - previous clip in timeline
                    _gaq.push(['_trackEvent', 'Hotkey', 'PrevClip']);

                    var prevClip = undefined;
                    if ( jQuery(".timeline-video-clips").children(".selected").length === 0 ) {
                        if (jQuery(".timeline-video-clips").children().length > 0) {
                            prevClip = jQuery(jQuery(".timeline-video-clips").children().first());
                        }
                    } else {
                        prevClip = jQuery(".timeline-video-clips").children(".selected").prev();
                    }

                    if ( prevClip ) {
                        prevClip.click();
                        var offset = prevClip.css('left');
                        if ( offset ) {
                            jQuery(".editor-timeline").scrollLeft(parseInt(offset.substring(0,offset.lastIndexOf("px"))));
                        }
                    }

                    updateScrubber();
                }
            }
        }
    );
})();