// Copyright 2016 Kelly Davis
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

(function(){
    var UPDATE_INTERVAL = 24 * 60 * 60 * 1000; // Update after 24 hours
    var PAUSED_MESSAGE = "Paused (spacebar to play)";
    var PLAYING_MESSAGE = "Playing (spacebar to pause)";

    var active = true;
    var publishRequested = false;
    var playing = false;
    var clipSelectState = 0;
    var initialized = false;
    var duration = 0;
    var appName = "Pro Mode for YouTube Video Editor";
    var appVersion = 0.1;
    var audioPreviewRequested = false;
    var audioPreviewPlaying = false;
    var videoPreviewRequested = false;
    var videoPreviewPlaying = false;

    var manifest = chrome.runtime.getManifest();
    appName = manifest.name;
    appVersion = manifest.version;

    var _gaq = new function() {
        this.push = function(evt) {
            chrome.runtime.sendMessage({event: evt}, function(response) {
                if ("Success" !== response) {
                    console.log("Unexpected error sending GA event: " + response);
                }
            });
        }
    }

    _gaq.push(['_trackPageview']);
    _gaq.push(['_trackEvent', 'Extension', 'GALoaded']);

    //Receives for messages for swf player events
    window.addEventListener("message", function(event) {
        if (!active) return;

        switch(event.data.type) {
            case 'yteditorpro_onStateChange':
                if ( event.data.data === -1 ) {
                    if ( audioPreviewRequested ) {
                        audioPreviewPlaying = true;
                        audioPreviewRequested = false;
                    } else {
                        audioPreviewPlaying = false;
                    }
                    if ( videoPreviewRequested ) {
                        videoPreviewPlaying = true;
                        videoPreviewRequested = false;
                    } else {
                        videoPreviewPlaying = false;
                    }
                } else if ( event.data.data === 1 &&
                            !playing ) {
                    if ( !audioPreviewPlaying && !videoPreviewPlaying ) { //allow preview audio to play
                        preview_swf.pauseVideo();
                    }
                }
                //update the duration
                duration = preview_swf.getDuration();
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

    function doWelcome() {
        chrome.storage.local.get({
             firstUsage: true,
             lastVersion: 0.16,
             publishCount: 0,
             promptForReview: true
        },
        function(items) {
            if ( items.firstUsage ) {
                _gaq.push(['_trackEvent', 'Extension', 'HelpFirstUsage']);

                //Pop the help screen automatically on first usage
                $("#yteditorpro_help").modal('toggle');

                chrome.storage.local.set({firstUsage: false});
            } else if ( items.lastVersion < parseFloat(appVersion)) {
                _gaq.push(['_trackEvent', 'Extension', 'WhatsNew']);

                //Pop the changes screen if there is a version update
                $("#yteditorpro_changes").modal('toggle');

                chrome.storage.local.set({lastVersion: parseFloat(appVersion)});
            } else if ( items.publishCount >= 1 ) {
                //If the user has not clicked either Ok! or No Thanks then we prompt after first publish or every third publish
                if ( !items.reviewCompleted &&
                     (items.promptForReview && (items.publishCount === 1 || items.publishCount % 3 === 0)) ) {
                    _gaq.push(['_trackEvent', 'Extension', 'ReviewPrompt']);
                    $("#yteditorpro_review").modal('toggle');
                }
            }
        });
    }

    function initialize() {
        var player = $("#preview-swf")[0];
        var playerType = (typeof player);
        if ((playerType === "function" || playerType === "object") &&
            (typeof player.getPlayerState === "function")) {
            setupPlayer(player);
        }

        //Try again in 1 second if initialization didn't occur
        if(!initialized) {
            setTimeout(initialize, 1000);
        } else {
            setupUI();
            doWelcome();
            updateTimelineScrollbar();

            //Setup the preview buttons so they set the audioPreviewRequested flag
            //and update every time the list of audio changes
            $("#audio-media-list").bind("DOMSubtreeModified", function(evt) {
                updateAudioPreviewClickHandlers();
            });
            $("#audio-tab").click(function(evt) {
                updateAudioPreviewClickHandlers();
            });

            $(".video-thumblist").bind("DOMSubtreeModified", function(evt) {
                updateVideoPreviewClickHandlers();
                updateVideoAddClickHandlers()
            });
            $("#video-tab, #cc-tab").click(function(evt) {
                updateVideoPreviewClickHandlers();
                updateVideoAddClickHandlers()
            });

            //Setup the thumb preview buttons so they set the viewPreviewRequested flag
            //and update every time the list of audio changes
            $("#images-media-list").bind("DOMSubtreeModified", function(evt) {
                updateImageAddClickHandlers();
            });
            $("#images-tab").click(function(evt) {
                updateImageAddClickHandlers();
            });
        }
    }

    //Sets up handlers on all the audio-preview buttons to set the audioPreviewRequest on click
    function updateAudioPreviewClickHandlers() {
        $(".audio-preview").not(".yte_flagged").click(function(evt) {
            audioPreviewRequested = true;
        });
        $(".audio-preview").not(".yte_flagged").addClass("yte_flagged");
    }

    //Sets up handlers on all the audio-preview buttons to set the audioPreviewRequest on click
    function updateVideoPreviewClickHandlers() {
        $(".thumb-play").not(".yte_flagged").click(function(evt) {
            videoPreviewRequested = true;
        });
        $(".thumb-play").not(".yte_flagged").addClass("yte_flagged");
    }

    function updateVideoAddClickHandlers() {
        //Fix the add video button to focus on the newly added clip
        $(".video-thumblist").find(".thumb-add").not(".yte_flagged").click(function(evt) {
            $(".timeline-video-clips").one("DOMSubtreeModified", function(evt) {
                scrubToLastClip(false);
            });
        });
        $(".video-thumblist").find(".thumb-add").not(".yte_flagged").addClass("yte_flagged");
    }

    function updateImageAddClickHandlers() {
        //Fix the add image button to focus on the newly added clip
        $("#images-tab-body").find(".thumb-add").not(".yte_flagged").click(function(evt) {
            $(".timeline-video-clips").one("DOMSubtreeModified", function(evt) {
                scrubToLastClip(false);
            });
        });
        $("#images-tab-body").find(".thumb-add").not(".yte_flagged").addClass("yte_flagged");
    }

    function updateTimelineScrollbar() {
        if ( !active || playing ) {
            $(".editor-timeline").css('overflow-x', 'scroll');
        } else {
            //Hide the timeline scrollbar
            $(".editor-timeline").css('overflow-x', 'hidden');

            //Prevent the scrollbar on the timeline from being moved separately from the scrubber
            var sliderValue = $("#timeline-scrubber").val();
            var timelineWidth = $(".editor-timeline")[0].scrollWidth - $(".editor-timeline")[0].clientWidth;
            var newScroll = Math.round((timelineWidth*sliderValue)/100);
            if ( $(".editor-timeline").scrollLeft() != newScroll) {
                $(".editor-timeline").scrollLeft(newScroll);
            }
        }
    }

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

    function toggleActive() {
        active = !active;

        if ( active ) {
            $("#page").addClass('promode_active');
            $("#yte_controls_panel").show();
            $("#play-state-msg").show();
            $(".yt_tab_hotkey_label").show();
            toastr["info"]("Activated");
        } else {
            $("#page").removeClass('promode_active');
            $("#yte_controls_panel").hide();
            $("#play-state-msg").hide();
            $(".yt_tab_hotkey_label").hide();
            toastr["info"]("Deactivated");
        }

        updateTimelineScrollbar();
    }

    function isClipSelected() {
        return $(".timeline-video-clips").children(".selected").length > 0;
    }

    function handleScrub() {
        var timelineWidth = $(".editor-timeline")[0].scrollWidth - $(".editor-timeline")[0].clientWidth;
        $(".editor-timeline").scrollLeft(Math.round((timelineWidth * this.value)/100));

        if ( !isClipSelected() ) {
            //Seek the playhead based on the scrubber position
            preview_swf.seekTo((duration * this.value)/100);
        }
    }

    function updateScrubber() {
        var timelineScroll = $(".editor-timeline").scrollLeft();
        var timelineWidth = $(".editor-timeline")[0].scrollWidth - $(".editor-timeline")[0].clientWidth;

        $("#timeline-scrubber").val(Math.round(10000 * timelineScroll/timelineWidth)/100);
    }

    function togglePlay() {
        var player = $("#preview-swf")[0];

        if (player.getPlayerState() == 1) {
            playing = false;
            player.pauseVideo();
            $("#timeline-scrubber").prop('disabled',false);
            $("#play-state-msg").text(PAUSED_MESSAGE);
            $("#play-state-msg").toggleClass('play-state-paused');
            $("#play-state-msg").toggleClass('play-state-playing');
            $("#pauseplay_button").toggleClass('pausebutton');
            $("#pauseplay_button").toggleClass('playbutton');
        } else {
            playing = true;
            player.playVideo();
            $("#timeline-scrubber").prop('disabled',true);
            $("#play-state-msg").text(PLAYING_MESSAGE);
            $("#play-state-msg").toggleClass('play-state-paused');
            $("#play-state-msg").toggleClass('play-state-playing');
            $("#pauseplay_button").toggleClass('pausebutton');
            $("#pauseplay_button").toggleClass('playbutton');
        }

        updateTimelineScrollbar();
    }

    function scrubToLastClip(focus) {
        //Focus on the new clip that was added
        var newClip = $(".timeline-video-clips").children().last();
        if ( newClip ) {
            if ( focus ) {
                newClip.click();
            }

            //Scroll to the end of the clip
            var editorTimeline = $(".editor-timeline");
            editorTimeline.scrollLeft(editorTimeline.find(".scroll-content").width());

            updateScrubber();
        }
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

	function handleUpload() {
		window.location = 'https://www.youtube.com/upload';
	}

    function setupUI() {
        //Update the timeline scrollbar on every scroll to lock it in place
        $(".editor-timeline").scroll(function(evt) {
            updateTimelineScrollbar();
        });

        $("#publish-button").click(function(evt) {
            publishRequested = true; //Leaving the page to publish video

            //Set the has published flag
            chrome.storage.local.set({hasPublished: true});

            chrome.storage.local.get({
                 publishCount: 0,
                 reviewCompleted: false
            },
            function(items) {
                //Increment publishCount and set the prompt for review flag
                chrome.storage.local.set({publishCount: (items.publishCount+1), promptForReview: !items.reviewCompleted});
            });
        });

        window.onbeforeunload = confirmExit;

        $("#page").addClass('promode_active');

        //Deactivate hotkeys when focused in text inputs
        $("input[type*=text], textarea").focus(function(evt){
           toggleActive();
        });
        $("input[type*=text], textarea").blur(function(evt){
            toggleActive();
        });

        //Reset clip select state when clip is clicked
        $(".timeline-video-clip").click(function(evt){
            clipSelectState = 0;
        });

        $(".editor-timeline").scroll(function(evt){
            if ( playing ) {
                updateScrubber();
            }
        });

        $("#storyboard").before("<div id='yte_controls_panel'><div id='pauseplay_button' class='playbutton playpausebutton'></div><input id='timeline-scrubber' type='range' min='0' max='100' value='0'/></div>");

        $("#pauseplay_button").click(function(evt) {
            togglePlay();
        });

        $("#timeline-scrubber").on("input change", handleScrub);

        $("#save-changes-message").after(" <span id='play-state-msg' class='play-state-paused'>" + PAUSED_MESSAGE + "</span>");

		//Add upload button
		$("#publish-button").after("<button class='yt-uix-button yt-uix-button-size-default yt-uix-button-primary' style='float: right;' type='button' id='upload-button'><span class='yt-uix-button-content'>Upload video</span></button>");
		$("#upload-button").on("click", handleUpload);

        //Tab hotkey indicators
        $("#video-tab").append('<span class="yt_tab_hotkey_label">1</span>');
        $("#cc-tab").append('<span class="yt_tab_hotkey_label">2</span>');
        $("#images-tab").append('<span class="yt_tab_hotkey_label">3</span>');
        $("#audio-tab").append('<span class="yt_tab_hotkey_label">4</span>');
        $("#transition-tab").append('<span class="yt_tab_hotkey_label">5</span>');
        $("#text-tab").append('<span class="yt_tab_hotkey_label">6</span>');

        //Handle scroll right / left with arrow keys
        $(document).keydown(function(evt){
            if ( evt.which == 39 ) { //scrub right
                var timelineWidth = $(".editor-timeline")[0].scrollWidth - $(".editor-timeline")[0].clientWidth;
                var timelineScroll = $(".editor-timeline").scrollLeft();
                timelineScroll = timelineScroll + .1 * timelineWidth;
                if ( timelineScroll > timelineWidth ) {
                    timelineScroll = timelineWidth;
                }
                $(".editor-timeline").scrollLeft(timelineScroll);
                updateScrubber();
            } else if ( evt.which == 37 ) { //scrub left
                var timelineWidth = $(".editor-timeline")[0].scrollWidth - $(".editor-timeline")[0].clientWidth;
                var timelineScroll = $(".editor-timeline").scrollLeft();
                timelineScroll = timelineScroll - .1 * timelineWidth;
                if ( timelineScroll < 0 ) {
                    timelineScroll = 0;
                }
                $(".editor-timeline").scrollLeft(timelineScroll);
                updateScrubber();
            }
        });

        $("body").append('<div id="yt_dialogs"/>');
        $("#yt_dialogs").load(chrome.extension.getURL('html/dialogs.html'), function() {
            $("#yteditorpro_help").modal({'show':false});
            $("#yteditorpro_changes").modal({'show':false});
            $("#yteditorpro_review").modal({'show':false});
            $(".yt_version_label").text(appVersion);
            $(".yt_appname_label").text(appName);

            $("#watch_demo").click(function(evt) {
                _gaq.push(['_trackEvent', 'Extension', 'WatchDemo']);
                window.open('https://www.youtube.com/watch?v=5FshFrRcFrw');
            });

            $("#write_review").click(function(evt) {
                _gaq.push(['_trackEvent', 'Extension', 'WriteReviewHelpScreen']);
                chrome.storage.local.set({reviewCompleted: true, promptForReview: false});
                window.open('https://chrome.google.com/webstore/detail/pro-mode-for-youtube-vide/aenmbapdfjdkanhfppdmmdipakgacanp/reviews');
            });

            $("#whats_new").click(function(evt) {
                _gaq.push(['_trackEvent', 'Extension', 'WhatsNewHelpScreen']);
                $("#yteditorpro_changes").modal('toggle');
                $("#yteditorpro_help").modal('toggle');
            });

            $("#get_help").click(function(evt) {
                _gaq.push(['_trackEvent', 'Extension', 'ClickSupport']);
                window.open('https://chrome.google.com/webstore/detail/pro-mode-for-youtube-vide/aenmbapdfjdkanhfppdmmdipakgacanp/support');
            });

            $("#review_ok").click(function(evt) {
                _gaq.push(['_trackEvent', 'Extension', 'ReviewOk']);
                chrome.storage.local.set({reviewCompleted: true, promptForReview: false});
                window.open('https://chrome.google.com/webstore/detail/pro-mode-for-youtube-vide/aenmbapdfjdkanhfppdmmdipakgacanp/reviews');
                $("#yteditorpro_review").modal('toggle');
            });

            $("#review_no").click(function(evt) {
                _gaq.push(['_trackEvent', 'Extension', 'ReviewNo']);
                chrome.storage.local.set({reviewCompleted: true, promptForReview: false});
                $("#yteditorpro_review").modal('toggle');
            });

            $("#review_later").click(function(evt) {
                _gaq.push(['_trackEvent', 'Extension', 'ReviewLater']);
                chrome.storage.local.set({promptForReview: false});
                $("#yteditorpro_review").modal('toggle');
            });
        });

        //Fix add video clip with Enter key behavior & play preview with space
        //
        $(".video-thumblist").keydown(function(event) {
            if ( event.which == 13 ) {
                scrubToLastClip(false);
            } else if ( event.which == 32 ) {
                videoPreviewRequested = true;
            }
        });

        //Hotkeys
        $(document).keypress(
            function(event) {
                if ( event.which == 1 ) { //CTRL-A
                    _gaq.push(['_trackEvent', 'Hotkey', 'ToggleActive']);
                    toggleActive();
                }

                if ( active ) {
                    if ( event.which == 99 ) { //C - Close current window
                        _gaq.push(['_trackEvent', 'Hotkey', 'CloseWindow']);
                        $(".close-button")[0].click();
                        $(".close-button")[1].click();
                    } else if ( event.which == 32 ) { //Spacebar - Pause/Play video
                        _gaq.push(['_trackEvent', 'Hotkey', 'PausePlay']);
                        event.preventDefault();

                        togglePlay();
                    } else if ( event.which == 115 ) { //S - sort thumbnails
                        _gaq.push(['_trackEvent', 'Hotkey', 'SortThumbnails']);
                        if ( $("#images-tab").attr('class').indexOf('selected') != -1 ) {
                            var parent = $($(".image-original")[0]).parent();
                            var images = $(".image-original").detach();
                            images.sort(function(a,b){
                                var urlA = $(a).find("img").css('background-image');
                                urlA = urlA.substring(urlA.lastIndexOf('/')+1);
                                var urlB = $(b).find("img").css('background-image');
                                urlB = urlB.substring(urlB.lastIndexOf('/')+1);
                                return urlA.localeCompare(urlB);
                            });
                            images.appendTo(parent);
                            toastr["info"]("Photos sorted alphabetically");
                        }
                    } else if ( event.which == 107) { //K - ken burns effect
                        _gaq.push(['_trackEvent', 'Hotkey', 'KenBurns']);
                        $("input[effectid*='KEN_BURNS']").click();
                        toastr["info"]("Pan & Zoom toggled");
                    } else if ( event.which == 43) { //+ key increase by one second selected clip
                        _gaq.push(['_trackEvent', 'Hotkey', 'Increase1S']);

                        var handle = $(".timeline-video-clips").children(".selected").find(".right-trimmer").find(".knurling-area");
                        if ( handle && handle.length > 0 ) {
                            var timeSpan = $(".timeline-video-clips").children(".selected").find(".editor-thumb-time");
                            if (timeSpan && timeSpan.length > 0) {
                                var startTime = parseClipTime(timeSpan[0].textContent);
                                var moveX = 0;
                                syn.simulate(handle[0], "mousedown", { pointerX: moveX, pointerY: 0 });
                                while (true) {
                                    moveX += 1;
                                    syn.simulate(handle[0], "mousemove", { pointerX: moveX, pointerY: 0 });
                                    if ((parseClipTime(timeSpan[0].textContent) - startTime)>= 1000 || moveX > 1000) {
                                        break;
                                    }
                                }
                                syn.simulate(handle[0], "mouseup");
                                toastr["info"]("Clip increased");
                            }
                        }
                    } else if ( event.which == 45) { //- key decrease by one second selected clip
                        _gaq.push(['_trackEvent', 'Hotkey', 'Decrease1S']);
                        var handle = $(".timeline-video-clips").children(".selected").find(".right-trimmer").find(".knurling-area");
                        if ( handle && handle.length > 0 ) {
                            var timeSpan = $(".timeline-video-clips").children(".selected").find(".editor-thumb-time");
                            if (timeSpan && timeSpan.length > 0) {
                                var currentTimeLabel = timeSpan[0].textContent;
                                if ( currentTimeLabel !== "0:01" && currentTimeLabel !== "0:00" ) {
                                    var startTime = parseClipTime(currentTimeLabel);
                                    var moveX = 1000;
                                    syn.simulate(handle[0], "mousedown", { pointerX: moveX, pointerY: 0 });
                                    while (true) {
                                        moveX -= 1;
                                        syn.simulate(handle[0], "mousemove", { pointerX: moveX, pointerY: 0 });
                                        if ((startTime - parseClipTime(timeSpan[0].textContent)) >= 1000 || moveX <= 0) {
                                            break;
                                        }
                                    }
                                    syn.simulate(handle[0], "mouseup");
                                    toastr["info"]("Clip decreased");
                                }
                            }
                        }
                    } else if ( event.which == 49) { //1 - video tab
                        _gaq.push(['_trackEvent', 'Hotkey', 'VideoTab']);
                        if ($("#mediapicker-infobox").attr('class') == "infobox-visible") {
                            $("#mediapicker-infobox").toggleClass("mediapicker-visible");
                            $("#mediapicker-infobox").toggleClass("infobox-visible");
                        }
                        $("#video-tab").click();
                    } else if ( event.which == 50) { //2 - copyright tab
                        _gaq.push(['_trackEvent', 'Hotkey', 'CopyrightTab']);
                        if ($("#mediapicker-infobox").attr('class') == "infobox-visible") {
                            $("#mediapicker-infobox").toggleClass("mediapicker-visible");
                            $("#mediapicker-infobox").toggleClass("infobox-visible");
                        }
                        $("#cc-tab").click();
                    } else if ( event.which == 51) { //3 images tab
                        _gaq.push(['_trackEvent', 'Hotkey', 'ImagesTab']);
                        if ($("#mediapicker-infobox").attr('class') == "infobox-visible") {
                            $("#mediapicker-infobox").toggleClass("mediapicker-visible");
                            $("#mediapicker-infobox").toggleClass("infobox-visible");
                        }
                        $("#images-tab").click();
                    } else if ( event.which == 52) { //4 audio tab
                        _gaq.push(['_trackEvent', 'Hotkey', 'AudioTab']);
                        if ($("#mediapicker-infobox").attr('class') == "infobox-visible") {
                            $("#mediapicker-infobox").toggleClass("mediapicker-visible");
                            $("#mediapicker-infobox").toggleClass("infobox-visible");
                        }
                        $("#audio-tab").click();
                    } else if ( event.which == 53) { //5 transitions tab
                        _gaq.push(['_trackEvent', 'Hotkey', 'VideoTab']);
                        if ($("#mediapicker-infobox").attr('class') == "infobox-visible") {
                            $("#mediapicker-infobox").toggleClass("mediapicker-visible");
                            $("#mediapicker-infobox").toggleClass("infobox-visible");
                        }
                        $("#transition-tab").click();
                    } else if ( event.which == 54) { //6 text tab
                        _gaq.push(['_trackEvent', 'Hotkey', 'TextTab']);
                        if ($("#mediapicker-infobox").attr('class') == "infobox-visible") {
                            $("#mediapicker-infobox").toggleClass("mediapicker-visible");
                            $("#mediapicker-infobox").toggleClass("infobox-visible");
                        }
                        $("#text-tab").click();
                    } else if ( event.which == 112 ) { //P - focus current clip
                        _gaq.push(['_trackEvent', 'Hotkey', 'FocusCurrent']);

                        var offset = $(".timeline-video-clips").children(".selected").css('left');
                        if ( offset ) {
                            if ( clipSelectState === 0 ) {
                                //Scroll to start of clip
                                $(".editor-timeline").scrollLeft(parseInt(offset.substring(0,offset.lastIndexOf("px"))));
                                clipSelectState = 1;
                                toastr["info"]("Start of selected clip");
                            } else if ( clipSelectState === 1 ) {
                                //Scroll to end of clip
                                var width = $(".timeline-video-clips").children(".selected").width();
                                $(".editor-timeline").scrollLeft(parseInt(offset.substring(0,offset.lastIndexOf("px"))) + width);
                                clipSelectState = 0;
                                toastr["info"]("End of selected clip");
                            }
                        }
                        updateScrubber();
                    } else if ( event.which == 91 ) { // [ - focus start
                        _gaq.push(['_trackEvent', 'Hotkey', 'FocusStart']);
                        $(".editor-timeline").scrollLeft(0);
                        updateScrubber();
                        toastr["info"]("Start of timeline");
                    } else if ( event.which == 93 ) { // ] - focus end
                        _gaq.push(['_trackEvent', 'Hotkey', 'FocusEnd']);
                        var offset = $(".timeline-video-clips").children().last().css('left');
                        $(".editor-timeline").scrollLeft(offset.substring(0,offset.lastIndexOf("px")));
                        updateScrubber();
                        toastr["info"]("End of timeline");
                    } else if ( event.which == 104 ) { // H - show help
                        _gaq.push(['_trackEvent', 'Hotkey', 'ToggleHelp']);
                        $("#yteditorpro_help").modal('toggle');
                    } else if ( event.which == 46 ) { // . - next clip in timeline
                        _gaq.push(['_trackEvent', 'Hotkey', 'NextClip']);

                        var nextClip = undefined;
                        if ( $(".timeline-video-clips").children(".selected").length === 0 ) {
                            if ($(".timeline-video-clips").children().length > 0) {
                                nextClip = $(".timeline-video-clips").children().first();
                            }
                        } else {
                            nextClip = $(".timeline-video-clips").children(".selected").next();
                        }

                        if ( nextClip ) {
                            nextClip.click();
                            var offset = nextClip.css('left');
                            if ( offset ) {
                                $(".editor-timeline").scrollLeft(parseInt(offset.substring(0,offset.lastIndexOf("px"))));
                            }
                            toastr["info"]("Select next clip");
                        }

                        updateScrubber();
                    } else if ( event.which == 44 ) { // , - previous clip in timeline
                        _gaq.push(['_trackEvent', 'Hotkey', 'PrevClip']);

                        var prevClip = undefined;
                        if ( $(".timeline-video-clips").children(".selected").length === 0 ) {
                            if ($(".timeline-video-clips").children().length > 0) {
                                prevClip = $($(".timeline-video-clips").children().first());
                            }
                        } else {
                            prevClip = $(".timeline-video-clips").children(".selected").prev();
                        }

                        if ( prevClip ) {
                            prevClip.click();
                            var offset = prevClip.css('left');
                            if ( offset ) {
                                $(".editor-timeline").scrollLeft(parseInt(offset.substring(0,offset.lastIndexOf("px"))));
                            }
                            toastr["info"]("Select previous clip");
                        }

                        updateScrubber();
                    }
                }
            }
        );

        toastr.options = {
          "closeButton": false,
          "debug": false,
          "newestOnTop": false,
          "progressBar": false,
          "positionClass": "toast-bottom-center",
          "preventDuplicates": false,
          "onclick": null,
          "showDuration": "100",
          "hideDuration": "400",
          "timeOut": "1200",
          "extendedTimeOut": "1000",
          "showEasing": "swing",
          "hideEasing": "linear",
          "showMethod": "fadeIn",
          "hideMethod": "fadeOut"
        }
    }

    initialize();
})();