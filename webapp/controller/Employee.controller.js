sap.ui.define([
    "bsim/hcmapp/man/movement/controller/BaseController",
    "bsim/hcmapp/man/movement/utils/formatter",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/suite/ui/commons/networkgraph/layout/LayeredLayout",
    "sap/suite/ui/commons/networkgraph/ActionButton"
], function (BaseController, formatter, JSONModel, MessageBox, MessageToast, Filter, FilterOperator, LayeredLayout, ActionButton) {
    "use strict";

    return BaseController.extend("bsim.hcmapp.man.movement.controller.Employee", {
        formatter: formatter,

        onInit: function () {
            // Initialize view and component
            this._oView = this.getView();
            this._oComponent = this.getOwnerComponent();
            this._oView.addStyleClass(this._oComponent.getContentDensityClass());
            this._oBusyDialog = new sap.m.BusyDialog();
            this._oODataModel = this._oComponent.getModel();

            // Initialize employee model first
            var oEmployeeModel = new JSONModel({
                results: []
            });
            this.setModel(oEmployeeModel, "employee");

            this.getRouter().getRoute("employee").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function (oEvent) {
            var oArgs = oEvent.getParameter("arguments");
            if (oArgs.EmployeeNumber) {
                // Handle the case where an EmployeeNumber is provided
                this._loadEmployeeData(oArgs.EmployeeNumber);
            } else {
                // Handle the case where no EmployeeNumber is provided
                this._loadUniversalData();
            }
        },

        _loadEmployeeData: function (EmployeeNumber) {
            return new Promise((resolve, reject) => {
                this._oBusyDialog.open();
                const oDataModel = this.getOwnerComponent().getModel();
                const oEmployeeModel = this.getView().getModel("employee");
        
                if (!oDataModel) {
                    MessageBox.error("OData model not found");
                    this._oBusyDialog.close();
                    reject("OData model not found");
                    return;
                }
        
                const sUrl = "/EmployeeSet('" + EmployeeNumber + "')/toEmployeeDetail";
                const mParameters = {
                    success: (oData) => {
                        if (oData && oData.results && oData.results.length > 0) {
                            oEmployeeModel.setData(oData.results[0]);
                        }
                        this._oBusyDialog.close();
                        resolve();
                        console.log("Employee Detail:", oData);
                    },
                    error: (oError) => {
                        let sErrorMsg = "Error loading employee data: ";
                        try {
                            const oErrorResponse = JSON.parse(oError.responseText);
                            sErrorMsg += oErrorResponse.error.message.value;
                            console.error("Error details:", oErrorResponse);
                        } catch (e) {
                            sErrorMsg += oError.message || "Unknown error";
                        }
                        MessageBox.error(sErrorMsg);
                        this._oBusyDialog.close();
                        reject(sErrorMsg);
                    }
                };
        
                // Execute the OData request
                oDataModel.read(sUrl, mParameters);
            });
        },

        onNavBack: function () {
            this.getRouter().navTo("overview");
        },

        _navBack: function () {
            this.getView().setBindingContext(null);
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

        onExit: function () {
            if (this._pQuickView) {
                this._pQuickView.then(function (oQuickView) {
                    oQuickView.destroy();
                });
            }
            this._currentEmployee = null;
        }
    });
});