sap.ui.define([
    "bsim/hcmapp/man/movement/controller/BaseController",
    "bsim/hcmapp/man/movement/utils/formatter",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
], function (Controller, f, J, M, Filter, O) {
    "use strict";

    return Controller.extend("bsim.hcmapp.man.movement.controller.Mutation", {
        formatter: f,

        onInit: function () {
            this._oView = this.getView();
            this._oComponent = this.getOwnerComponent();
            this._oView.addStyleClass(this._oComponent.getContentDensityClass());
            this._oBusy = new sap.m.BusyDialog();
            this.getRouter().getRoute("mutation").attachPatternMatched(this._onRouteMatched, this);

            // Create a JSON model with default selectedIndex = 0 (first option)
            var oModel = new sap.ui.model.json.JSONModel({
                selectedIndex: 0
            });

            // Set the model at the view level
            this._oView.setModel(oModel, "potensiKerugian");
        },

        _onRouteMatched: function (oEvent) {
            var oArgs = oEvent.getParameter("arguments");
            if (oArgs.id) {
                // Handle the case where an id is provided
                this._loadData(oArgs.id);
            } else {
                // Handle the case where no id is provided
                this._loadUniversalData();
            }
        },

        _loadData: function (id) {
            // Load data specific to the provided id
        },

        _loadUniversalData: function () {
            // Load universal data
        },

        onDisplayDocumentWarning: function () {
            this.getRouter().navTo("mutation");
            console.log("Employee Pressed");
        },

        onNavBack: function () {
            this.getRouter().navTo("orgchart");
        },

        _navBack: function () {
            let oView = this.getView(); // Get the view dynamically

            if (oView) {
                oView.setBindingContext(null);
            }

            let p = sap.ui.core.routing.History.getInstance().getPreviousHash(),
                i = sap.ushell && sap.ushell.Container && sap.ushell.Container.getService("CrossApplicationNavigation");

            if (p !== undefined) {
                if (i && !i.isInitialNavigation()) {
                    i.historyBack(1);
                } else {
                    window.history.go(-1);
                }
            } else if (i) {
                i.toExternal({
                    target: { shellHash: "#" },
                });
            }
        }
    });
});