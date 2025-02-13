sap.ui.define([
    "bsim/hcmapp/man/movement/controller/BaseController",
    "bsim/hcmapp/man/movement/utils/formatter",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment"
], function (Controller, f, J, M, Filter, O, Fragment) {
    "use strict";

    return Controller.extend("bsim.hcmapp.man.movement.controller.History", {
        formatter: f,

        onInit: function () {
            this._oView = this.getView();
            this._oComponent = this.getOwnerComponent();
            this._oView.addStyleClass(this._oComponent.getContentDensityClass());
            this._oBusy = new sap.m.BusyDialog();
            // this.getRouter().getRoute("overview").attachPatternMatched(this._onOverviewRouteMatched, this);
        },
        
        onCreateReq: function () {
            this.getRouter().navTo("warningCreateRequest", {create: "create"});
            
            console.log("Crete Request Pressed");

        }, 

        _onOverviewRouteMatched: function (t) {
            this._getInitialData();
        },

        _getInitialData: function () {
           
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
        },
        
                // Handle Submit Request Button
                onSubmitRequest: function () {
                    // var oView = this.getView();
        
                    // // Get values from input fields
                    // var sEmployeeId = oView.byId("employeeIdInput").getValue();
                    // var sWarningLetter = oView.byId("warningLetterInput").getValue();
                    // var sRequestDate = oView.byId("requestDatePicker").getDateValue();
                    // var sStatus = oView.byId("statusSelect").getSelectedKey();
        
                    // Validate input (basic check)
                    if (!sEmployeeId || !sWarningLetter || !sRequestDate || !sStatus) {
                        MessageBox.error("Please fill in all fields.");
                        return;
                    }
        
                    // Perform necessary logic (e.g., send data to backend)
                    MessageBox.success("Request Created Successfully!");
        
                    // Close the dialog
                    this.onCloseDialog();
                }   
    });
}
);