# Vintage Letter Website

A physical-feeling digital letter that appears when someone taps an NFC sticker. The letter writes itself in real time on translucent vellum paper, laid over a collage of vintage photographs. The recipient can lift the vellum to reveal the photographs underneath.

## What It Does

This is a single-page mobile-first website designed to feel like a physical object, not a webpage:

1. **Photo Collage**: Scattered vintage photographs fill the background with warm, sepia tones
2. **Vellum Layer**: A translucent cream paper sheet sits on top, making the photos ghost through
3. **Handwritten Letter**: Text appears in real time as if written with a fountain pen
4. **Interactive Peel**: Grab the corner and lift the vellum to reveal the photos in full color

## How to Use

### Preview Locally

```bash
npm install
npm run dev
```

Open the provided URL on your phone or desktop browser.

### Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory. Host these on any static file server.

## Customizing the Letter

### Change the Letter Text

Edit the file `letter.txt` in the root directory. Write your letter as plain text. The writing animation will preserve your formatting, including paragraphs and line breaks.

### Replace the Photos

1. Place your photos in `public/photos/`
2. Name them anything you want (e.g., `photo1.jpg`, `sunset.png`, `memory.jpg`)
3. Update the `PHOTOS` array at the top of `src/main.js`:

```javascript
const PHOTOS = [
  '/photos/your-photo-1.jpg',
  '/photos/your-photo-2.jpg',
  '/photos/your-photo-3.jpg',
  // Add as many as you want
];
```

The photos will be automatically arranged in the collage. For best results:
- Use 4-6 photographs
- Mix landscape and portrait orientations
- Photos can be any format: `.jpg`, `.png`, `.webp`, etc.

### Adjust the Writing Speed

In `src/main.js`, modify these values:

```javascript
const BASE_SPEED = 45;          // Base milliseconds per character
const SPEED_VARIANCE = 25;      // Random variance in speed
const PAUSE_AFTER_PUNCTUATION = {
  '.': 400,  // Pause in milliseconds after periods
  ',': 200,  // Pause after commas
  // etc.
};
```

Lower numbers = faster writing. Higher numbers = slower, more deliberate writing.

## NFC Setup

This site doesn't implement Web NFC APIs. Instead, the NFC sticker simply stores this website's URL.

### What You Need

1. **NFC Stickers**: NTAG213 or NTAG215 tags work well (available on Amazon, ~$15 for 10)
2. **NFC Writing App**: 
   - iOS: "NFC Tools" (free)
   - Android: "NFC Tools" or "Trigger" (free)

### How to Program the Sticker

1. Build and host this website somewhere (Netlify, Vercel, GitHub Pages, etc.)
2. Get the full URL (e.g., `https://your-letter.netlify.app`)
3. Open your NFC writing app
4. Choose "Write" → "Add a Record" → "URL/URI"
5. Paste your website URL
6. Hold your phone to the NFC sticker until it says "Write successful"

Now when someone taps their phone to the sticker, this website will open in their browser.

### Where to Put the Sticker

- On the back of a drawing or card
- Inside a frame behind a photo
- On a gift box
- Embedded in a handmade object

The sticker is thin enough to hide almost anywhere. Modern phones (iPhone XS and newer, most Android phones) can read NFC tags through paper and thin materials.

## Technical Details

- **Stack**: Vanilla HTML, CSS, and JavaScript with Vite for building
- **Mobile-First**: Optimized for portrait phone screens (iOS and Android)
- **No Backend**: Pure static site, works entirely in the browser
- **Performance**: Small bundle size, loads quickly on cellular
- **Safe Areas**: Respects iPhone notches and Android gesture bars
- **PWA-Ready**: Can be enhanced with a manifest for "Add to Home Screen"

## Aesthetic Notes

The design evokes late 19th/early 20th century correspondence:
- Iron-gall ink color (brown-black)
- Cream vellum paper with subtle fiber texture
- Polaroid-style photo borders
- Washi tape accents
- Film grain overlay
- Warm sepia tones

Nothing should feel digital. No rounded buttons, no sans-serif fonts, no UI chrome.

## Browser Support

Works on:
- iOS Safari (iOS 12+)
- Android Chrome (Android 7+)
- Desktop browsers (Chrome, Firefox, Safari, Edge)

The experience is designed for mobile but looks beautiful on desktop for previewing.

## Troubleshooting

**The letter doesn't start writing**
- Some browsers block automatic animations. Try tapping anywhere on the screen to start.

**The peel interaction doesn't work**
- Wait until the letter finishes writing
- Look for the corner affordance in the bottom-right
- Try dragging upward from the corner

**Photos don't load**
- Check that photo files are in `public/photos/`
- Verify the paths in the `PHOTOS` array match your filenames
- Check browser console for 404 errors

## License

This is a gift. Use it, modify it, make it yours.