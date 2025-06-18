// ==UserScript==
// @name         GeoFS卫星版地图插件测试版（D打开隐藏界面）
// @version      1.1
// @description  可根据使用者电脑需求自定义更新频率和加载范围的卫星地图
// @author       bilibili開飛機のzm
// @match        https://www.geo-fs.com/geofs.php?v=*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        unsafeWindow
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// ==/UserScript==

(function() {
    'use strict';
    
    // 默认配置
    const defaultConfig = {
        imagerySource: "arcgis",
        maxZoomLevel: 19,
        terrainQuality: "high",
        focusRadius: 10000,
        updateInterval: 5000,
        showPanel: false
    };

    // 存储兼容性方案
    const storage = {
        get: function(key) {
            try {
                return typeof GM_getValue !== 'undefined' ? GM_getValue(key) : 
                    localStorage.getItem(key) ? JSON.parse(localStorage.getItem(key)) : null;
            } catch (e) {
                console.error('读取存储失败:', e);
                return null;
            }
        },
        set: function(key, value) {
            try {
                if (typeof GM_setValue !== 'undefined') {
                    GM_setValue(key, value);
                } else {
                    localStorage.setItem(key, JSON.stringify(value));
                }
                return true;
            } catch (e) {
                console.error('保存存储失败:', e);
                return false;
            }
        }
    };

    // 从存储加载配置或使用默认值
    let config = {
        ...defaultConfig,
        ...(storage.get('geoFSConfig') || {})
    };

    // 存储飞机位置和状态
    let aircraftPosition = null;
    let updateTimer = null;
    let isPanelVisible = config.showPanel;

    // 添加自定义样式
    const addStyles = function() {
        const style = document.createElement('style');
        style.textContent = `
            #geoFS-settings-panel {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 20px;
                border-radius: 10px;
                z-index: 9999;
                font-family: Arial, sans-serif;
                box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
                display: none;
                width: 300px;
            }
            
            #geoFS-settings-panel h1 {
                font-size: 20px;
                margin: 0 0 5px 0;
                text-align: center;
                color: #4CAF50;
            }
            
            #geoFS-settings-panel h2 {
                font-size: 14px;
                margin: 0 0 15px 0;
                text-align: center;
                color: #9E9E9E;
                font-weight: normal;
            }
            
            .geoFS-setting-row {
                margin-bottom: 15px;
            }
            
            .geoFS-setting-row label {
                display: block;
                margin-bottom: 5px;
                font-size: 14px;
            }
            
            .geoFS-setting-row input {
                width: 100%;
                padding: 8px;
                border-radius: 4px;
                border: 1px solid #555;
                background: #333;
                color: white;
            }
            
            #geoFS-save-btn {
                background: #4CAF50;
                color: white;
                border: none;
                padding: 10px 15px;
                border-radius: 4px;
                cursor: pointer;
                width: 100%;
                font-weight: bold;
                transition: background 0.3s;
            }
            
            #geoFS-save-btn:hover {
                background: #45a049;
            }
            
            .geoFS-unit {
                font-size: 12px;
                color: #9E9E9E;
                margin-left: 5px;
            }
        `;
        document.head.appendChild(style);
    };

    // 创建设置面板
    function createSettingsPanel() {
        const panel = document.createElement('div');
        panel.id = 'geoFS-settings-panel';
        
        panel.innerHTML = `
            <h1>GeoFS卫星版地图</h1>
            <h2>由bilibili開飛機のzm制作</h2>
            
            <div class="geoFS-setting-row">
                <label for="geoFS-update-interval">
                    更新频率 <span class="geoFS-unit">(毫秒)</span>
                </label>
                <input type="number" id="geoFS-update-interval" value="${config.updateInterval}" min="1000" step="1000">
            </div>
            
            <div class="geoFS-setting-row">
                <label for="geoFS-radius">
                    加载半径 <span class="geoFS-unit">(米)</span>
                </label>
                <input type="number" id="geoFS-radius" value="${config.focusRadius}" min="1000" step="1000">
            </div>
            
            <button id="geoFS-save-btn">保存设置</button>
        `;
        
        document.body.appendChild(panel);
        
        // 保存按钮事件
        document.getElementById('geoFS-save-btn').addEventListener('click', saveSettings);
        
        // 显示/隐藏面板
        updatePanelVisibility();
    }

    // 更新面板可见性
    function updatePanelVisibility() {
        const panel = document.getElementById('geoFS-settings-panel');
        if (panel) {
            panel.style.display = isPanelVisible ? 'block' : 'none';
        }
    }

    // 保存设置
    function saveSettings() {
        config.updateInterval = parseInt(document.getElementById('geoFS-update-interval').value) || 5000;
        config.focusRadius = parseInt(document.getElementById('geoFS-radius').value) || 10000;
        config.showPanel = isPanelVisible;
        
        if (storage.set('geoFSConfig', config)) {
            // 重新初始化定时器
            restartTracking();
            
            // 关闭面板
            isPanelVisible = false;
            updatePanelVisibility();
            
            alert('设置已保存！');
        } else {
            alert('保存设置失败，请查看控制台获取详细信息');
        }
    }

    // 配置地形
    function configureTerrain() {
        // 清理不需要的API
        if (window.geofs.api.analytics) {
            delete window.geofs.api.analytics;
        }

        // 设置ArcGIS地图源
        const arcgisProvider = new Cesium.ArcGisMapServerImageryProvider({
            url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
            maximumLevel: config.maxZoomLevel
        });

        // 应用配置
        window.geofs.api.setImageryProvider(arcgisProvider, false);
        
        // 地形设置
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

    // 更新地图视图范围
    function updateViewExtent() {
        if (!aircraftPosition) return;
        
        try {
            const viewer = window.geofs.api.viewer;
            if (!viewer) return;
            
            // 计算半径范围内的区域
            const radius = config.focusRadius;
            const rectangle = Cesium.Rectangle.fromCartesianArray([
                Cesium.Cartesian3.add(aircraftPosition, new Cesium.Cartesian3(-radius, -radius, 0), new Cesium.Cartesian3()),
                Cesium.Cartesian3.add(aircraftPosition, new Cesium.Cartesian3(radius, radius, 0), new Cesium.Cartesian3())
            ]);
            
            // 设置相机约束
            viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;
            viewer.scene.screenSpaceCameraController.minimumZoomDistance = 100;
            viewer.scene.screenSpaceCameraController.maximumZoomDistance = radius * 1.5;
            
            // 设置地图加载范围
            viewer.scene.globe.tileCacheSize = 20;
            viewer.scene.globe.maximumScreenSpaceError = 2;
            
            // 保持原始XZ设置
            window.geofs.mapXYZ = "https://data.geo-fs.com/osm/{z}/{x}/{y}.png";
            
        } catch (e) {
            console.error("更新视图范围出错:", e);
        }
    }

    // 获取飞机位置
    function trackAircraftPosition() {
        try {
            const aircraft = window.geofs.aircraft.instance;
            if (aircraft && aircraft.object3d) {
                const position = aircraft.object3d.position.clone();
                aircraftPosition = new Cesium.Cartesian3(position.x, position.y, position.z);
                updateViewExtent();
            }
        } catch (e) {
            console.error("获取飞机位置出错:", e);
        }
    }

    // 重新开始跟踪
    function restartTracking() {
        if (updateTimer) {
            clearInterval(updateTimer);
        }
        trackAircraftPosition();
        updateTimer = setInterval(trackAircraftPosition, config.updateInterval);
    }

    // 安全初始化
    function safeInit() {
        try {
            if (window.geofs && window.geofs.api) {
                addStyles();
                configureTerrain();
                createSettingsPanel();
                
                // 开始跟踪飞机位置
                restartTracking();
                
                // 触发地图更新事件
                if (window.jQuery) {
                    setTimeout(() => {
                        window.jQuery("body").trigger("mapUpdated");
                    }, 1000);
                }
            }
        } catch (e) {
            console.log("Terrain enhancement loaded:", e);
        }
    }

    // 清理定时器
    function cleanup() {
        if (updateTimer) {
            clearInterval(updateTimer);
            updateTimer = null;
        }
    }

    // 初始化键盘事件
    function initKeyEvents() {
        document.addEventListener('keydown', (e) => {
            // 按D键切换面板
            if (e.key.toLowerCase() === 'd') {
                isPanelVisible = !isPanelVisible;
                updatePanelVisibility();
            }
        });
    }

    // 通过多种方式确保执行
    if (document.readyState === 'complete') {
        safeInit();
        initKeyEvents();
    } else {
        window.addEventListener('load', () => {
            safeInit();
            initKeyEvents();
        });
        document.addEventListener('DOMContentLoaded', () => {
            safeInit();
            initKeyEvents();
        });
    }
    
    // 页面卸载时清理
    window.addEventListener('beforeunload', cleanup);
})();
