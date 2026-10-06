/**
 * @import { ElementInput } from './input/element-input.js'
 * @import { GamePads } from '../platform/input/game-pads.js'
 * @import { GraphicsDevice } from '../platform/graphics/graphics-device.js'
 * @import { Keyboard } from '../platform/input/keyboard.js'
 * @import { Mouse } from '../platform/input/mouse.js'
 * @import { TouchDevice } from '../platform/input/touch-device.js'
 */
/**
 * An Application represents and manages your PlayCanvas application. If you are developing using
 * the PlayCanvas Editor, the Application is created for you. You can access your Application
 * instance in your scripts. Below is a skeleton script which shows how you can access the
 * application 'app' property inside the initialize and update functions:
 *
 * ```javascript
 * // Editor example: accessing the pc.Application from a script
 * var MyScript = pc.createScript('myScript');
 *
 * MyScript.prototype.initialize = function() {
 *     // Every script instance has a property 'this.app' accessible in the initialize...
 *     const app = this.app;
 * };
 *
 * MyScript.prototype.update = function(dt) {
 *     // ...and update functions.
 *     const app = this.app;
 * };
 * ```
 *
 * If you are using the Engine without the Editor, you have to create the application instance
 * manually.
 */
export class Application extends AppBase {
    /**
     * Create a new Application instance.
     *
     * Automatically registers these component systems with the application's component system registry:
     *
     * - anim ({@link AnimComponentSystem})
     * - animation ({@link AnimationComponentSystem})
     * - audiolistener ({@link AudioListenerComponentSystem})
     * - button ({@link ButtonComponentSystem})
     * - camera ({@link CameraComponentSystem})
     * - collision ({@link CollisionComponentSystem})
     * - element ({@link ElementComponentSystem})
     * - layoutchild ({@link LayoutChildComponentSystem})
     * - layoutgroup ({@link LayoutGroupComponentSystem})
     * - light ({@link LightComponentSystem})
     * - model ({@link ModelComponentSystem})
     * - particlesystem ({@link ParticleSystemComponentSystem})
     * - rigidbody ({@link RigidBodyComponentSystem})
     * - render ({@link RenderComponentSystem})
     * - screen ({@link ScreenComponentSystem})
     * - script ({@link ScriptComponentSystem})
     * - scrollbar ({@link ScrollbarComponentSystem})
     * - scrollview ({@link ScrollViewComponentSystem})
     * - sound ({@link SoundComponentSystem})
     * - sprite ({@link SpriteComponentSystem})
     *
     * @param {HTMLCanvasElement | OffscreenCanvas} canvas - The canvas element.
     * @param {object} [options] - The options object to configure the Application.
     * @param {ElementInput} [options.elementInput] - Input handler for {@link ElementComponent}s.
     * @param {Keyboard} [options.keyboard] - Keyboard handler for input.
     * @param {Mouse} [options.mouse] - Mouse handler for input.
     * @param {TouchDevice} [options.touch] - TouchDevice handler for input.
     * @param {GamePads} [options.gamepads] - Gamepad handler for input.
     * @param {string} [options.scriptPrefix] - Prefix to apply to script urls before loading.
     * @param {string} [options.assetPrefix] - Prefix to apply to asset urls before loading.
     * @param {GraphicsDevice} [options.graphicsDevice] - The graphics device used by the
     * application. If not provided, a WebGl graphics device will be created.
     * @param {object} [options.graphicsDeviceOptions] - Options object that is passed into the
     * {@link GraphicsDevice} constructor.
     * @param {string[]} [options.scriptsOrder] - Scripts in order of loading first.
     * @example
     * // Engine-only example: create the application manually
     * const app = new pc.Application(canvas, options);
     *
     * // Start the application's main loop
     * app.start();
     */
    constructor(canvas: HTMLCanvasElement | OffscreenCanvas, options?: {
        elementInput?: ElementInput;
        keyboard?: Keyboard;
        mouse?: Mouse;
        touch?: TouchDevice;
        gamepads?: GamePads;
        scriptPrefix?: string;
        assetPrefix?: string;
        graphicsDevice?: GraphicsDevice;
        graphicsDeviceOptions?: object;
        scriptsOrder?: string[];
    });
    createDevice(canvas: any, options: any): WebglGraphicsDevice;
    addComponentSystems(appOptions: any): void;
    addResourceHandles(appOptions: any): void;
}
import { AppBase } from './app-base.js';
import { WebglGraphicsDevice } from '../platform/graphics/webgl/webgl-graphics-device.js';
import type { ElementInput } from './input/element-input.js';
import type { Keyboard } from '../platform/input/keyboard.js';
import type { Mouse } from '../platform/input/mouse.js';
import type { TouchDevice } from '../platform/input/touch-device.js';
import type { GamePads } from '../platform/input/game-pads.js';
import type { GraphicsDevice } from '../platform/graphics/graphics-device.js';
