// Configuration for the animation.
var slideTime = 100;    // duration in ms.
var minTimeSlice = 17;  // ← 60fps.

// Controls for the slides: right = forward, left = back.
window.addEventListener('keypress', function(e) {
  var slide = visibleSlide();
  if (e.keyCode === e.DOM_VK_RIGHT && (slide = nextSlide(slide))) {
    slide.slideIntoView();
  } else if (e.keyCode === e.DOM_VK_LEFT && (slide = prevSlide(slide))) {
    slide.slideIntoView();
  }
});

function nextSlide(slide) {
  while (slide.nextElementSibling &&
         slide.nextElementSibling.tagName !== 'SLIDE') {
    slide = slide.nextElementSibling;
  }
  return slide.nextElementSibling;
}

function prevSlide(slide) {
  while (slide.previousElementSibling &&
         slide.previousElementSibling.tagName !== 'SLIDE') {
    slide = slide.previousElementSibling;
  }
  return slide.previousElementSibling;
}

// Keep track of the current slide.
// Returns the first slide below the top of the viewport.
function visibleSlide() {
  var slides = document.getElementsByTagName('slide');
  for (var i = 0; i < slides.length; i++) {
    var slideBounds = slides[i].getBoundingClientRect();
    var middleOfSlide = (slideBounds.bottom + slideBounds.top) / 2;
    if (middleOfSlide >= 0) {
      // First slide that's below the viewport.
      return slides[i];
    }
  }
}

// Animation to slide an element to the center of the viewport.
Element.prototype.slideIntoView = function() {
  var rect = this.getBoundingClientRect();
  var endy = window.scrollY + rect.top
           - (window.innerHeight - this.offsetHeight) * 0.5;
  var signy = endy - window.scrollY > 0? 1: -1;
  var jumpNPixels = 1;
  var count = 0;
  var total = Math.abs(window.scrollY - endy);
  var timeSlice = slideTime / Math.abs(window.scrollY - endy) * jumpNPixels;
  if (timeSlice < minTimeSlice) {
    jumpNPixels = minTimeSlice * Math.abs(window.scrollY - endy) / slideTime;
    timeSlice = slideTime / Math.abs(window.scrollY - endy) * jumpNPixels;
  }
  // Scroll by jumpNPixels till we get to the slide.
  var intervalid = setInterval(function() {
    window.scrollBy(0, signy * jumpNPixels);
    count += jumpNPixels;
    if (count >= total) {
      clearInterval(intervalid);
      window.scroll(0, endy);
    }
  }, timeSlice);
};

// vim: ft=javascript
