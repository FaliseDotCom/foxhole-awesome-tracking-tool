/**
 * Logistics vehicles in speed classes, and a fuel estimate for a route. Pure, so it runs in
 * Node tests. Figures from the Foxhole Wiki page of each vehicle, marked accurate for the game
 * version below; see .docs/research/2026-11-25-route-navigation.md. Check them after each
 * game update.
 *
 * Fuel is used per minute of driving, so litres per km are the use per minute divided by the
 * speed. The estimate is on the high side on purpose: every vehicle is taken fully loaded (the
 * largest slowdown the wiki gives), a class uses the figures of its thirstiest vehicle, and a
 * safety margin is added on top for bends, hills, junctions, mud and weather.
 */

/**
 * Game version the vehicle figures are from.
 * @type {string}
 */
export const GAME_VERSION = '1.67';

/**
 * Safety margin on the fuel estimate, as a factor: 1.25 adds 25 %.
 * @type {number}
 */
export const SAFETY_MARGIN = 1.25;

/**
 * Factor from a speed in m/s to km per minute.
 * @type {number}
 */
const km_per_minute = 60 / 1000;

/**
 * Speed classes, fastest first; the first is the default. Trucks have a class of their own, as
 * they use about half the fuel per km of anything else; the fuel tanker drives about as fast as
 * the heavy-duty trucks.
 * @type {{ key: string, title: string, label: string }[]}
 */
export const VEHICLE_CLASSES = [
  { key: 'fast', title: 'Fast', label: 'trucks' },
  { key: 'medium', title: 'Medium', label: 'fuel tankers and heavy-duty trucks' },
  { key: 'slow', title: 'Slow', label: 'flatbeds' }
];

/**
 * Logistics vehicles (Warden / Colonial names): speed class, tank in litres, fuel use in litres
 * per minute, top speed on road and off-road in m/s, empty, and how much a full load slows it
 * down (0.28 is 28 % slower). The fuel tanker's slowdown is not given; it is taken as the
 * largest of the others.
 * @type {{ name: string, cls: string, tank: number, use: number, road: number, offroad: number, load: number }[]}
 */
export const VEHICLES = [
  { name: 'Dunne Transport / R-1 Hauler', cls: 'fast', tank: 100, use: 1.5, road: 17.32, offroad: 3.46, load: .28 },
  { name: 'Dunne Fuelrunner 2d / RR-3 Stolon Tanker', cls: 'medium', tank: 100, use: 3, road: 16.17, offroad: 4.85, load: .28 },
  { name: 'Cnute Cliffwrest', cls: 'medium', tank: 150, use: 3, road: 15.66, offroad: 4.70, load: .28 },
  { name: 'AU-A150 Taurine Rigger', cls: 'medium', tank: 150, use: 3, road: 14.06, offroad: 5.63, load: .24 },
  { name: 'BMS - Packmule Flatbed', cls: 'slow', tank: 150, use: 3, road: 9.78, offroad: 4.89, load: .20 }
];

/**
 * Litres per km at a speed.
 *
 * @param {number} use   Fuel use in litres per minute.
 * @param {number} speed Speed in m/s.
 * @returns {number} Litres per km.
 */
export const litresPerKm = ( use, speed ) => use / ( speed * km_per_minute );

/**
 * Figures of a speed class: litres per km on and off the road of its thirstiest vehicle, fully
 * loaded; the smallest tank; the loaded road speed of its slowest vehicle in km/h; and its
 * vehicles.
 *
 * @param {string} key Class key from VEHICLE_CLASSES.
 * @returns {{ road: number, offroad: number, tank: number, speed: number, vehicles: string[] }}
 *   Figures, all 0 for an unknown class.
 */
export const classFigures = key =>
{
  const members = VEHICLES.filter( vehicle => vehicle.cls === key );
  if ( !members.length ) return { road: 0, offroad: 0, tank: 0, speed: 0, vehicles: [] };

  return {
    road: Math.max( ...members.map( v => litresPerKm( v.use, v.road * ( 1 - v.load ) ) ) ),
    offroad: Math.max( ...members.map( v => litresPerKm( v.use, v.offroad * ( 1 - v.load ) ) ) ),
    tank: Math.min( ...members.map( v => v.tank ) ),
    speed: Math.min( ...members.map( v => v.road * ( 1 - v.load ) * 3.6 ) ),
    vehicles: members.map( v => v.name )
  };
};

/**
 * Fuel estimate for a route, safety margin included, rounded up to whole litres.
 *
 * @param {number} road    Distance on the road in km.
 * @param {number} offroad Distance off the road in km (to and from the road).
 * @param {string} key     Class key from VEHICLE_CLASSES.
 * @returns {{ litres: number, tank: number, overTank: boolean }} Litres, the class's smallest
 *   tank, and whether the estimate needs more than that tank holds.
 */
export const estimateFuel = ( road, offroad, key ) =>
{
  const figures = classFigures( key ),
        litres = Math.ceil( ( road * figures.road + offroad * figures.offroad ) * SAFETY_MARGIN );
  return { litres, tank: figures.tank, overTank: litres > figures.tank };
};
