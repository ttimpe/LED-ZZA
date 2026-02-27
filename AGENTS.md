OK, this next project is an LED-based train/tram arrival display.
We will build it using HTML and CSS. I have exact dimensions of the device which we want to emulate including pixel count etc. 
Let's plan the first. The final output will be an HTML file, a JS file and a CSS file.

Full dimensions of the device:
455mm height, 1240mm width, 244mm depth

Two fields:
1. Line number field: 274mm height, 189mm width
2. Destination field: 274mm height, 892mm width

The line field is 32x48 pixels.
the destination field is 48x160 pixels i believe.

I think the pitch of the LEDs is 5.5mm

The line field is RGB, the destination field is amber

I want have a switch to make the destination field on the left instead of the right.

The device casing is black.

Let's start with the HTML file.

1. Create the device in HTML and CSS according to the given description.

2. add an editor mode that lets me turn the LEDs on and off by clicking them. Let me set the line field RGB pixel's colors.

3. Then let me create the fonts neccessary for the display. These will later be saved in a JSON file.

4. I will give you a list of lines, destinations / routes and the appropriate colors for the line field.

5. Final product will have manual mode (dropdown to select line/destination/location of the device) and an automatic mode that fetches data from a tram/train API and displays it on the device. Also, it will have an IBIS mode which will accept VDV 300 telegrams (l000 line number, k00 course number as there are some special designs we will need to show and destination number z000)

6. I will generate TTS audio announcement files for the device. These will be added later.

For manual mode, we will also have a JSON config.