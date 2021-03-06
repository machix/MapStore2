/*
 * Copyright 2017, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
*/
const Rx = require('rxjs');

const {LOAD_FEATURE_INFO, ERROR_FEATURE_INFO, GET_VECTOR_INFO, FEATURE_INFO_CLICK, updateCenterToMarker} = require('../actions/mapInfo');
const {closeFeatureGrid} = require('../actions/featuregrid');
const {CHANGE_MOUSE_POINTER, CLICK_ON_MAP, zoomToPoint} = require('../actions/map');
const {MAP_CONFIG_LOADED} = require('../actions/config');
const {stopGetFeatureInfoSelector} = require('../selectors/mapinfo');
const {centerToMarkerSelector} = require('../selectors/layers');
const {mapSelector} = require('../selectors/map');
const {boundingMapRectSelector} = require('../selectors/maplayout');
const {centerToVisibleArea, isInsideVisibleArea} = require('../utils/CoordinatesUtils');
const {getCurrentResolution} = require('../utils/MapUtils');

/**
 * Epics for Identify and map info
 * @name epics.identify
 * @type {Object}
 */

module.exports = {
    closeFeatureGridFromIdentifyEpic: (action$) =>
        action$.ofType(LOAD_FEATURE_INFO, GET_VECTOR_INFO)
        .switchMap(() => {
            return Rx.Observable.of(closeFeatureGrid());
        }),
    changeMapPointer: (action$, store) =>
        action$.ofType(CHANGE_MOUSE_POINTER)
        .filter(() => !(store.getState()).map)
        .switchMap((a) => action$.ofType(MAP_CONFIG_LOADED).mapTo(a)),
    onMapClick: (action$, store) =>
        action$.ofType(CLICK_ON_MAP).filter(() => {
            const {disableAlwaysOn = false} = (store.getState()).mapInfo;
            return disableAlwaysOn || !stopGetFeatureInfoSelector(store.getState() || {});
        })
        .map(({point, layer}) => ({type: FEATURE_INFO_CLICK, point, layer})),
    /**
     * Centers marker on visible map if it's hidden by layout
     * @param {external:Observable} action$ manages `FEATURE_INFO_CLICK` and `LOAD_FEATURE_INFO`.
     * @memberof epics.identify
     * @return {external:Observable}
     */
    zoomToVisibleAreaEpic: (action$, store) =>
        action$.ofType(FEATURE_INFO_CLICK)
        .filter(() => centerToMarkerSelector(store.getState()))
        .switchMap((action) =>
            action$.ofType(LOAD_FEATURE_INFO, ERROR_FEATURE_INFO)
            .switchMap(() => {
                const state = store.getState();
                const map = mapSelector(state);
                const boundingMapRect = boundingMapRectSelector(state);
                const coords = action.point && action.point && action.point.latlng;
                const resolution = getCurrentResolution(Math.round(map.zoom), 0, 21, 96);
                // exclude cesium with cartographic options
                if (!map || !boundingMapRect || !coords || action.point.cartographic || isInsideVisibleArea(coords, map, boundingMapRect, resolution)) {
                    return Rx.Observable.of(updateCenterToMarker('disabled'));
                }
                const center = centerToVisibleArea(coords, map, boundingMapRect, resolution);
                return Rx.Observable.of(updateCenterToMarker('enabled'), zoomToPoint(center.pos, center.zoom, center.crs));
            })
        )
};
