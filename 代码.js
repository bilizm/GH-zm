// ==UserScript==
// @name         GeoFS卫星版地图
// @version      1.0
// @description  感谢使用，如果觉得满意点个关注~任何问题b站私信
// @author       bilibili開飛機のzm
// @match        https://www.geo-fs.com/geofs.php?v=*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    
    const terrainConfig = {
        imagerySource: "arcgis",
        maxZoomLevel: 19,
        terrainQuality: "high"
    };

    function configureTerrain() {
        if (window.geofs.api.analytics) {
            delete window.geofs.api.analytics;
        }


        const arcgisProvider = new Cesium.ArcGisMapServerImageryProvider({
            url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
            maximumLevel: terrainConfig.maxZoomLevel
        });


        window.geofs.api.setImageryProvider(arcgisProvider, false);
        

        window.geofs.api.viewer.terrainProvider = 
            new window.geofs.api.FlatRunwayTerrainProvider({
                baseProvider: new Cesium.CesiumTerrainProvider({
                    url: "https://data.geo-fs.com/srtm/",
                    requestWaterMask: false,
                    requestVertexNormals: true
                }),
                maximumLevel: 12
            });
    }


    function safeInit() {
        try {
            if (window.geofs && window.geofs.api) {
                configureTerrain();
                

                window.geofs.mapXYZ = "https://data.geo-fs.com/osm/{z}/{x}/{y}.png";
                

                if (window.jQuery) {
                    setTimeout(() => {
                        window.jQuery("body").trigger("mapUpdated");
                    }, 1000);
                }
            }
        } catch (e) {
            console.log("Terrain enhancement loaded");
        }
    }


    if (document.readyState === 'complete') {
        safeInit();
    } else {
        window.addEventListener('load', safeInit);
        document.addEventListener('DOMContentLoaded', safeInit);
    }
})();
