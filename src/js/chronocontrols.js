'use strict';

var ChronoControls = function(container) {
    this.totalPlayTime = 10.0;
    this.paused = true;
    this.loop = true;

    // Create controls from imported html.
    var content = document.querySelector('link[rel="import"]').import;
    var controls = content.getElementById('chrono-controls');
    container.appendChild(controls);

    this.playPause = document.getElementById('chrono-playPauseButton');
    this.timeInput = document.getElementById('chrono-timeInput');
    this.dateBox   = document.getElementById('chrono-dateBox');

    // Listen to play/pause events (button click and space bar).
    this.playPause.addEventListener('click', this.handlePlayPause.bind(this),
                                    false);
    document.onkeypress = function(event) {
      if (event.keyCode === 32) {
        event.preventDefault();
        this.handlePlayPause();
      }
    }.bind(this);

    // Also update if the input slider is changed directly.
    this.timeInput.addEventListener('change', this.updateTimeDisplay.bind(this),
                                    false);
};


ChronoControls.prototype.getTime = function() {
    return this.timeInput.value;
};


ChronoControls.prototype.setTimeRange = function(minTime, maxTime) {
    this.minTime = minTime;
    this.maxTime = maxTime;
    this.timeRange = maxTime - minTime;

    this.timeInput.setAttribute('min', minTime);
    this.timeInput.setAttribute('max', maxTime);
    this.setInputTime(minTime);
};


ChronoControls.prototype.setInputTime = function(inputTime) {
    var clampedValue = Math.max(Math.min(inputTime, this.maxTime),
                                this.minTime);
    this.timeInput.value = clampedValue;

    this.updateTimeDisplay();
};


ChronoControls.prototype.updateTimeDisplay = function() {
    var date = new Date(parseFloat(this.timeInput.value));
    this.dateBox.textContent = this.getFormattedDate(date);
};


ChronoControls.prototype.getFormattedDate = function(date) {
    var year = date.getFullYear();
    var month = (1 + date.getMonth()).toString();
    month = month.length > 1 ? month : '0' + month;
    var day = date.getDate().toString();
    day = day.length > 1 ? day : '0' + day;
    return year + '/' + month + '/' + day;
};


ChronoControls.prototype.handlePlayPause = function() {
  this.loop = false;
  this.paused = !this.paused;
  if (parseFloat(this.timeInput.value) >= this.maxTime) {
    this.paused = true;
    this.setInputTime(this.minTime);
  }
};


ChronoControls.prototype.update = function(dt) {
    if (!this.paused) {
      // Scale dt to cover this.timeRange over this.totalPlaytime.
      var deltaTime = this.timeRange / this.totalPlayTime * dt;
      var newTime = parseFloat(this.timeInput.value) + deltaTime;
      this.setInputTime(newTime);

      // End of time range? Loop back to the start or pause.
      if (newTime >= this.maxTime) {
        if (this.loop) {
          this.setInputTime(this.minTime);
        } else {
          this.paused = true;
        }
      }
    }
};


module.exports = ChronoControls;
