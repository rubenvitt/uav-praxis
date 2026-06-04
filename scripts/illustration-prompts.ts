/**
 * Maneuverspezifischer Motiv-Zusatz pro Aufgabe (§14). Schlüssel = taskId aus
 * src/data/tasks.ts (1-1 … 3-5). Der Text wird im Generator an BASIS_PROMPT
 * angehängt ("This image shows: …"). Flugbahn-Manöver werden als bold red line
 * mit Pfeilen gezeigt; Spezialfälle (Pilotfigur, Sensoren, Geofence …) gemäß
 * Vorgabe. Englische Motivtexte sind bewusst gewählt (besseres Modellverständnis).
 */
export const MOTIVE: Record<string, string> = {
  // ── Teil 1 – Grundlegende Steuerung ─────────────────────────────────────────
  '1-1':
    'The drone hovering perfectly still in place at low altitude, about two metres above a small marker on the ground. No travel path — emphasise a steady, balanced stationary hover. A faint red dashed vertical guide line shows it holding height.',
  '1-2':
    'The drone descending vertically onto a clearly marked landing pad on the ground, its nose pointing away from the viewer. A bold red downward arrow traces the descent path onto the pad.',
  '1-3':
    'The drone flying a straight forward line of about ten metres and back to the start. A bold straight red line with directional arrows marks the out-and-back path along one axis, the drone orientation unchanged.',
  '1-4':
    'The drone flying a rectangular pattern (right, forward, left, backward) back to the start while keeping the same orientation. A bold red rectangle outline with directional arrows marks the path on the ground plane.',
  '1-5':
    'The drone flying forward then making a smooth U-turn and returning. A bold red U-shaped line with arrows shows the path, the turn drawn as a rounded 180-degree bend.',
  '1-6':
    'The drone circling tightly around a small target object on the ground, nose always pointing in the direction of flight. A bold red circular orbit line with arrows surrounds the target.',
  '1-7':
    'The drone flying point-to-point between two target markers and back to start, nose in the flight direction. A bold red poly-line with arrows connects start, target 1 and target 2.',
  '1-8':
    'The drone flying a horizontal figure-eight with two loops about five metres across. A bold red figure-eight (infinity) line with directional arrows lies on the ground plane.',
  '1-9':
    'A pilot figure standing in the centre holding a remote controller, with the drone flying a complete circle around the pilot. A bold red circular path with arrows encircles the central pilot.',

  // ── Teil 2 – Sichere Steuerung in einsatznahen Situationen ──────────────────
  '2-1':
    'A close, central view of a drone remote controller in hand, with several abstract flight-mode icons (e.g. position, tripod, sport) floating beside it rendered in red as clean glowing glyphs. Focus on the controller and the mode selection.',
  '2-2':
    'The drone flying a large horizontal figure-eight far away, loops about fifteen metres across, seen from a distance. A bold red figure-eight (infinity) line with directional arrows marks the wide path.',
  '2-3':
    'A pilot figure standing in the centre holding a remote controller, with the distant drone flying a very large complete circle around the pilot at altitude. A bold red wide circular path with arrows encircles the central pilot.',
  '2-4':
    'The drone flying toward a distant ground target while holding a defined constant altitude, without using camera or telemetry. A bold red horizontal flight line with arrows runs at a fixed height toward the target, a faint red height reference line below.',
  '2-5':
    'A close view of the drone with its camera gimbal prominent, projecting a red scanning cone downward from the lens, suggesting daylight and thermal sensor testing. Emphasise the gimbal and the red scan cone.',
  '2-6':
    'The drone approaching sideways and landing on top of a raised flat-topped object (like a tall box or stand) to show the ground-effect change. A bold red sideways-then-down path with an arrow ends on the raised surface.',
  '2-7':
    'A parked vehicle blocks the line of sight between the pilot and a landing pad. A pilot figure stands behind the vehicle without direct view, and a separate observer (spotter) figure stands in front with a clear view of the drone landing. The drone descends to the pad with a red descent arrow.',
  '2-8':
    'The drone in flight with a red crossed-out satellite warning symbol above it (GPS failure), and red drift-and-correction arrows showing the pilot manually counteracting sideways drift. Emphasise the warning symbol and corrective control.',
  '2-9':
    'A pilot figure in the foreground looking down at the remote controller while the drone flies far in the distance beyond sight. A bold red sensor-connection line links controller and distant drone, suggesting navigation by sensors only.',
  '2-10':
    'The drone flying an obstacle course: passing between two upright posts, under a leaning ladder, and toward several markers, ending on a landing spot. A bold red winding course line with arrows threads between the posts and under the ladder.',

  // ── Teil 3 – Training von Einsatzszenarien ──────────────────────────────────
  '3-1':
    'The drone conducting an aerial search over a defined area shown as a red lawn-mower search grid pattern on the ground, with a single red glowing person figure detected within the grid. Emphasise the red search raster and the glowing target.',
  '3-2':
    'The drone orbiting a small simulated incident scene on the ground, capturing it from several camera angles. A bold red orbit line with arrows surrounds the scene, with a few thin red view-cone lines indicating the different perspectives.',
  '3-3':
    'A night scene: the drone hovering above and casting a bright cone of light onto a moving person below, following them. A bold red motion path on the ground traces the person’s movement; the light cone is warm against the dark surroundings.',
  '3-4':
    'The drone carrying a small slung load suspended beneath it on a short line, flying toward a defined drop-off position. A bold red flight path with an arrow leads to the target marker where the load is to be set down.',
  '3-5':
    'The drone operating inside a clearly defined operation area bounded by a red geofence boundary — a translucent red vertical fence/wall outlining the permitted zone on the ground. The drone stays within the red boundary.',
};
