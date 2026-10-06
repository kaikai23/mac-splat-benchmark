/**
 * Callback used by {@link script.createLoadingScreen}.
 */
export type CreateScreenCallback = (app: AppBase) => any;
/**
 * Callback used by {@link script.create}.
 */
export type CreateScriptCallback = (app: AppBase) => object;
export namespace script {
    let app: any;
    /**
     * Handles the creation of the loading screen of the application. A script can subscribe to the
     * events of a {@link AppBase} to show a loading screen, progress bar etc. In order for
     * this to work you need to set the project's loading screen script to the script that calls
     * this method.
     *
     * @param {CreateScreenCallback} callback - A function which can set up and tear down a
     * customized loading screen.
     * @example
     * pc.script.createLoadingScreen(function (app) {
     *     var showSplashScreen = function () {};
     *     var hideSplashScreen = function () {};
     *     var showProgress = function (progress) {};
     *     app.on("preload:start", showSplashScreen);
     *     app.on("preload:progress", showProgress);
     *     app.on("start", hideSplashScreen);
     * });
     */
    function createLoadingScreen(callback: CreateScreenCallback): void;
}
import type { AppBase } from './app-base.js';
