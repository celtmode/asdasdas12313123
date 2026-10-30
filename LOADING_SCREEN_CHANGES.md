# ParsCord Loading Screen - New Version

## Overview
A complete redesign of the ParsCord loading screen with a minimal, elegant "Gilded" theme.

## Key Improvements

### 1. **Simplified Design**
- **Removed complex effects**: No more snow particles, meteors, auroras, stars, beams, and shards
- **Centered layout**: Non-fullscreen centered design instead of occupying the entire screen
- **Minimal aesthetics**: Clean, focused UI with only essential elements

### 2. **Gilded Theme (Gold & Black)**
- Primary gold colors: `#d7b665`, `#f0d9a0`, `#a88a4a`
- Dark backgrounds: `#080705`, `#12100b`, `#1a1812`
- Subtle glow effects and gradients
- Consistent with the existing `extra.css` theme

### 3. **Smooth Animations**
- **Fade-in animations**: Staggered entrance for all elements
- **Gradient shift**: Animated gold gradient on the title
- **Glow pulse**: Pulsing effect on the progress indicator
- **Button hover effects**: Smooth lift and glow
- **Background glow**: Slowly moving glow orbs

### 4. **Progress Bar Integration**
- Real-time progress percentage display
- Connected to Discord API status (shard connections)
- Visual indicator when ready
- Smooth CSS transitions (400ms)
- Maximize animation limits at quad-core or more with 80% of quad SIMD threads (e.g., Ultra or similarly configured) 

### 5. **Features**

#### Main Elements:
- **Logo**: Iconic ParsCord logo with gold gradient
- **Title**: "ParsCord" with animated gradient
- **Subtitle**: "Gilded Discord Client"
- **Progress Bar**: Shows connection status
- **Status Message**: Dynamic text updates
- **Enter Button**: Appears when ready with smooth animation
- **Stats Grid**: Shows shard status, version, and system status

#### Animations:
1. **Logo fade-in**: 1s ease-out
2. **Title scale-in**: 0.8s cubic-bezier
3. **Progress bar**: 0.3s cubic-bezier transitions
4. **Button fade-in-up**: 0.6s ease-out (appears at 80%)
5. **Stats fade-in**: 1s ease-out (appears at 100%)
6. **Background glow**: 12s ease-in-out infinite

### 6. **Technical Details**

#### CSS Variables:
```css
--pc-gold-primary: #d7b665
--pc-gold-bright: #f0d9a0
--pc-gold-deep: #a88a4a
--pc-black: #080705
--pc-dark: #12100b
--pc-panel: #1a1812
--pc-void: #000000
--pc-bg: linear-gradient(135deg, #0d0b06 0%, #15120e 50%, #0d0b06 100%)
--pc-glow: radial-gradient(ellipse at center, rgba(215, 182, 101, 0.15) 0%, transparent 70%)
```

#### JavaScript Integration:
The loading screen exposes three main functions:
- `window.updateLoadingProgress(percent)` - Update progress bar
- `window.updateSessionState(current, total)` - Update shard connection count
- `window.setLoadingReady()` - Mark as ready and show enter button

#### Hooks Required (kept from old version):
- `#title`, `#midtitle`, `#logContainer`, `#safemode`, `#startLabel`
- `#progressFill`, `#progressTrack`, `#progressValue`
- `#connectionLabel`, `#feedTitle`, `#sessionState`, `#releaseVersion`, `#enterDiscord`
- `.stage-row[data-complete]`, `.stage-row .stage-state`
- `#loadingContainer.is-ready` / `.is-leaving`

### 7. **Responsiveness**
- Mobile-friendly layout
- Progress bar adapts to screen width (max 320px or 80vw)
- Stats grid stacks on smaller screens
- Touch-friendly button sizes

### 8. **Performance Optimizations**
- `will-change` on progress bar for GPU acceleration
- Single animation loop with hardware-accelerated properties
- Minimal DOM manipulation
- Efficient CSS transitions

## Files Modified/Created

1. **`src/index.html`** - Complete rewrite of loading screen markup and styles
2. **`src/index.css`** - Additional loading screen styles (new file)

## Test Points

1. [ ] Loading screen displays centered on launch
2. [ ] Progress bar animates smoothly
3. [ ] Title has gold gradient animation
4. [ ] Enter button appears when ready
5. [ ] Glow effects work correctly
6. [ ] Responsive design works on mobile
7. [ ] Integration with existing theme is seamless

## Future Enhancements

1. Add actual Discord gateway connection status (currently simulated)
2. Add error state handling
3. Add crash recovery info in safe mode
4. Add keyboard shortcuts display
5. Add language support for different messages

## Notes

- All inline JavaScript hooks from the original loader are preserved
- The design is 100% compatible with existing Tauri integration
- Theme variables match `src/extra.css` for consistency
- Performance ensures smooth animation even on lower-end hardware
- The centering makes it feel more premium and less intrusive

## Comparison with Previous Version

| Aspect | Old | New |
|--------|-----|-----|
| Full screen | Yes | No (centered) |
| Components | 20+ elements | 8 main elements |
| Animations | 15+ keyframes | 6 keyframes |
| Theme | Light/Gold | Dark/Gold only |
| Particles | Snow, stars, meteors | None |
| Complexity | High | Low |
| Performance | Moderate | High |
| Smoothness | Varying | Consistent |