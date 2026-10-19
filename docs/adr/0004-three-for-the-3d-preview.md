# The 3D preview uses Three.js; the 2D plan stays on Canvas 2D

The 3D preview used to sort and paint every triangle of the scene on a 2D canvas each frame, which cannot keep up with scenery, terrain sculpting or an onboard camera. It now renders the scene with Three.js (WebGL, depth buffer, orbit controls), loaded on demand so the editor starts without it. The 2D plan keeps its Canvas 2D renderer: it draws few primitives, needs pixel-exact hit tests on points, roadway and barriers, and has no use for a depth buffer.
