sap.ui.define([
    "bsim/hcmapp/man/movement/controller/BaseController",
    "bsim/hcmapp/man/movement/utils/formatter",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
], function (Controller, f, J, M, Filter, O, UIComponent, FilterOperator) {
    "use strict";

    return Controller.extend("bsim.hcmapp.man.movement.controller.Overview", {
        formatter: f,

        onInit: function () {
            this._oView = this.getView();
            this._oComponent = this.getOwnerComponent();
            this._oView.addStyleClass(this._oComponent.getContentDensityClass());
            this._oBusy = new sap.m.BusyDialog();
            this.getRouter().getRoute("overview").attachPatternMatched(this._onOverviewRouteMatched, this);
        },

        _onOverviewRouteMatched: function () {
            this._getInitialData();
        },

        _getInitialData: function () {
            
        },

        onSearch: function () {
            
        },

        onActReqPressed: function () {
            this.getRouter().navTo("orgchart");
        },

        onAppPressed: function () {
            this.getRouter().navTo("approval");
        },
        
        onNavBack: function () {
            this._navBack();
        },

        _navBack: function () {
            this._oView.setBindingContext(null);
            let p = sap.ui.core.routing.History.getInstance().getPreviousHash(),
                i = sap.ushell && sap.ushell.Container && sap.ushell.Container.getService("CrossApplicationNavigation");
            if (p !== undefined) {
                if (i && !i.isInitialNavigation()) {
                    i.historyBack(1);
                } else {
                    window.history.go(-1);
                }
            } else {
                i.toExternal({
                    target: {
                        shellHash: "#",
                    },
                });
            }
        },
    });
}
);