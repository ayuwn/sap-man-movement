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
            this._currentUser();
            this.getRouter().getRoute("overview").attachPatternMatched(this._onOverviewRouteMatched, this);
        },

        _onOverviewRouteMatched: function () {
            this._getInitialData();
        },

        _getInitialData: function () {
            const sEmployeePath = "/EmployeeSet";
            const sRequestPath = "/RequestSet";
            const oDataModel = this.getOwnerComponent().getModel(); // Get the default OData model
        
            if (!oDataModel) {
                console.error("OData model not available");
                return;
            }
        
            this._oBusy.open();

            // Load EmployeeSet
            oDataModel.read(sEmployeePath, {
                urlParameters: { "$format": "json" }, // Ensure JSON format
                success: function (oData) {
                    console.log("Employee Set loaded:", oData);
        
                    // Get or create the employee model
                    let oEmployeeModel = this.getView().getModel("employee");
                    if (!oEmployeeModel) {
                        oEmployeeModel = new sap.ui.model.json.JSONModel({ results: [] });
                        this.getView().setModel(oEmployeeModel, "employee");
                    }
        
                    // Set the data to the employee model
                    oEmployeeModel.setProperty("/results", oData.results || oData);
        
                    // Update the appParam model with the employee count
                    const oParamModel = this.getView().getModel("appParam");
                    if (oParamModel) {
                        oParamModel.setProperty("/employeeCount", oData.results.length);
                    }
        
                    this._oBusy.close();
                }.bind(this),
                error: function (oError) {
                    console.error("Error loading Employee Set:", oError);
                    this._oBusy.close();
                }.bind(this),
            });

            // Load RequestSet
            oDataModel.read(sRequestPath, {
                urlParameters: { "$format": "json" }, // Ensure JSON format
                success: function (oData) {
                    console.log("Request Set loaded:", oData);
        
                    // Update the appParam model with the request count
                    const oParamModel = this.getView().getModel("appParam");
                    if (oParamModel) {
                        oParamModel.setProperty("/requestCount", oData.results.length);
                    }
                }.bind(this),
                error: function (oError) {
                    console.error("Error loading Request Set:", oError);
                }.bind(this),
            });
        
            this._oBusy.close();
        },

        _currentUser: function () {
            // Show busy indicator
            this._oBusy.open();
        
            var oDataModel = this.getOwnerComponent().getModel(); // Get the default OData model
        
            if (!oDataModel) {
                console.error("OData model not available");
                this._oBusy.close();
                MessageBox.error("System error: OData model not available");
                return;
            }
        
            // Call the EmployeeDetailSet endpoint to get logged-in user details
            oDataModel.read("/EmployeeDetailSet", {
                success: function (oData) {
                    console.log("Current user data received:", oData);
        
                    if (!oData || !oData.results || oData.results.length === 0) {
                        this._oBusy.close();
                        MessageBox.error("No user data received from server");
                        return;
                    }
        
                    // Get the first user from the results
                    var oCurrentUser = oData.results[0];
        
                    // Store the employee ID for later use
                    this._sEmployeeId = oCurrentUser.EmployeeNumber;
        
                    // Create a model for current user details
                    var oCurrentUserModel = new sap.ui.model.json.JSONModel(oCurrentUser);
                    this._oView.setModel(oCurrentUserModel, "currentUser");
        
                    this._oBusy.close();
                }.bind(this),
                error: function (oError) {
                    this._oBusy.close();
                    console.error("Error fetching current user data:", oError);
                    MessageBox.error(
                        "Failed to load user details: " +
                        (oError.responseText ? JSON.parse(oError.responseText).error.message.value : "Unknown error")
                    );
                }.bind(this)
            });
        },

        onSearch: function () {
            
        },

        onActReqPressed: function () {
            this.getRouter().navTo("orgchart");
        },

        onAppPressed: function () {
            this.getRouter().navTo("approval");
        },

        onHistoryPressed: function () {
            this.getRouter().navTo("history");
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