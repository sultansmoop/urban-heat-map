Urban Heat Map Simulation

An interactive simulation webpage that models how different materials affect local temperatures. Paint materials onto a grid and watch the heat map update in real time, powered by a real Surface Energy Balance equation. Open index.html in any browser to try it out.

Features:
Drag-paint grid: click or drag to paint any cell with a material; the simulation recalculates instantly
Resizable grid: slider adjusts from 3×3 up to 12×12
Normal / Heat Map toggle: switch between material colours and a blue -> yellow -> red temperature overlay
Live temperature metrics: average, hottest, and coolest surface temperatures update with every edit
Tree canopy buffer zone: grass and water cells cool their 8 neighbours, modelling the tree canopy effect
Reset action: reset to a baseline concrete city

Getting Started:
Clone or download the repository
Open index.html in your favourite browser
Select a material from the palette on the left
Click or drag cells on the grid to paint
Toggle Heat Map to see the temperature pattern

Physics Model:
Each cell's surface temperature is computed using a simplified Surface Energy Balance:
T_surface = T_ambient + (Solar_in × (1 − albedo) - QE − QE_buffer) / k
This is a simplified form of the full Surface Energy Balance equation:

Q* + Q_F = Q_H + Q_E + ΔQ_S
Long-wave radiation and anthropogenic heat (Q_F) are omitted for clarity. The albedo and QE relationships are faithful to published environmental science literature.

Tree Canopy Buffer Zone:
Every grass or water cell shares a fraction of its evaporative cooling with each of its ≤8 neighbours:
QE_buffer[neighbour] += QE_grass × BUFFER_FRAC (BUFFER_FRAC = 0.35)
This models the measurable cooling halo that urban green space creates around it. one park tile cools eight surrounding cells.


Background: Urban Heat Islands:
Cities are on average 1-7 °C warmer than the surrounding countryside. The primary cause is the replacement of natural surfaces (such as nature) which cool through evapotranspiration with dark impermeable materials (such as concrete) that absorb solar radiation and store it as heat.

Examples:
The ice-albedo feedback loop: as snow and ice melt and expose darker rock or water, more solar radiation is absorbed, accelerating further melting. This positive feedback is one of the most consequential mechanisms in climate science.

Urban greening: adding grass borders and water corridors to a dense city grid can reduce average surface temperatures by 10-16 °C in this model. Real cities including Singapore, Vienna, and Melbourne have implemented equivalent strategies with documented outcomes.


License:
This project is released for educational use.
