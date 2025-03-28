sap.ui.define([
    "bsim/hcmapp/man/movement/controller/BaseController",
    "bsim/hcmapp/man/movement/utils/formatter",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment",
    "sap/ushell/services/UserInfo"
], function (BaseController, formatter, JSONModel, MessageBox, Filter, FilterOperator, Fragment, UserInfo) {
    "use strict";

    return BaseController.extend("bsim.hcmapp.man.movement.controller.History", {
        formatter: formatter,

        onInit: function () {
            this._oView = this.getView();
            this._oComponent = this.getOwnerComponent();
            this._oView.addStyleClass(this._oComponent.getContentDensityClass());
            this._oBusy = new sap.m.BusyDialog();
            this._oHistoryModel = new JSONModel();
            this.getView().setModel(this._oHistoryModel, "historyModel");
            this.getRouter().getRoute("history").attachPatternMatched(this._onHistoryRouteMatched, this);
        },

        reqListSearchField: function(oEvent) {
            let sValue = oEvent.getParameter("value");
            let oFilter = new Filter({
                filters: [
                    new Filter("EmployeeNumber", FilterOperator.EQ, sValue),
                    new Filter("EmployeeName/FormattedName", FilterOperator.Contains, sValue)
                ],
                and: false
            }),
             oBinding = oEvent.getSource().getBinding("items");
            oBinding.filter([oFilter]);
        },

        // onEmployeePressed: function (oNode) {
        //     var sEmployeeNumber = oNode.getKey();

        //     if (!sEmployeeNumber) {
        //         console.error("No Employee Number found in node data");
        //         return;
        //     }

        //     console.log("Navigating to mutation page with Employee Number:", sEmployeeNumber);

        //     var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        //     oRouter.navTo("detailhistory", {
        //         EmployeeNumber: sEmployeeNumber
        //     });
        // },

        onEmployeePressed: function (oEvent) {
            var oItem = oEvent.getSource();
            var oContext = oItem.getBindingContext("historyModel");
            var sRequestId = oContext.getProperty("RequestId");

            if (!sRequestId) {
                console.error("No Employee Number found in node data");
                return;
            }

            console.log("Navigating to detail history with request id:", sRequestId);

            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("detailhistory", {
                RequestId: sRequestId
            });
        },

        // onEmployeePressed: function (oEvent) {
        //     // Get the selected item from the list/table
        //     var oItem = oEvent.getSource();
        //     var oContext = oItem.getBindingContext("historyModel");
            
        //     if (oContext) {
        //         // Get the employee ID from the selected item
        //         var sEmployeeId = oContext.getProperty("EmployeeNumber");
                
        //         // Navigate to the warning display with the selected employee ID
        //         this.getRouter().navTo("detailhistory", {
        //             employeeId: sEmployeeId
        //         });
                
        //         console.log("Employee Pressed: " + sEmployeeId);
        //     } else {
        //         // Handle case when no item is selected
        //         sap.m.MessageBox.error("Please select an employee from the list");
        //     }
        // },

        _onHistoryRouteMatched: function (t) {
            this._getInitialData();
        },

        _getInitialData: function () {
            const oDataModel = this.getOwnerComponent().getModel();
        
            if (!oDataModel) {
                console.error("OData model not available");
                return;
            }
        
            this._oBusy.open();
        
            // Fetch data from /RequestSet
            oDataModel.read("/RequestSet", {
                urlParameters: { "$expand": "toApproval" }, // Expand the toApproval navigation property
                success: function (oRequestData) {
                    console.log("RequestSet loaded:", oRequestData);
        
                    // Fetch data from /EmployeeDetailSet for each employee in RequestSet
                    const aPromises = oRequestData.results.map(request => {
                        return new Promise((resolve, reject) => {
                            // Fetch EmployeeDetailSet
                            oDataModel.read(`/EmployeeDetailSet('${request.EmployeeNumber}')`, {
                                success: function (oEmployeeData) {
                                    // Fetch ApproverName from toApproval
                                    const sRequestPath = `/RequestSet(guid'${request.RequestId}')/toApproval`;
                                    oDataModel.read(sRequestPath, {
                                        success: function (oApprovalData) {
                                            console.log("Approval Data:", oApprovalData); 
                                            resolve({
                                                RequestId: request.RequestId,
                                                EmployeeNumber: request.EmployeeNumber,
                                                EmployeeName: oEmployeeData.EmployeeName || request.EmployeeName,
                                                DivisionText: oEmployeeData.DivisionText,
                                                ActionType: oEmployeeData.ActionType,
                                                ActionTypeDesc: oEmployeeData.ActionTypeDesc,
                                                Massg: request.Massg,
                                                PlansDesc_Dest: request.PlansDesc_Dest,
                                                MassgDesc: request.MassgDesc,
                                                ZbegdaEfktf: request.ZbegdaEfktf,
                                                CreatedOn: request.CreatedOn,
                                                StatusText: request.StatusText,
                                                ApproverName: oApprovalData.results && oApprovalData.results.length > 0 ? oApprovalData.results[0].ApproverName : ""
                                            });
                                        },
                                        error: function (oError) {
                                            console.error(`Error loading toApproval for RequestId ${request.RequestId}:`, oError);
                                            reject(oError);
                                        }
                                    });
                                },
                                error: function (oError) {
                                    console.error(`Error loading EmployeeDetailSet for EmployeeNumber ${request.EmployeeNumber}:`, oError);
                                    reject(oError);
                                }
                            });
                        });
                    });
        
                    // Wait for all promises to resolve
                    Promise.all(aPromises)
                        .then(aCombinedData => {
                            console.log("Combined data:", aCombinedData);
        
                            // Set the combined data to the historyModel
                            const oHistoryModel = new sap.ui.model.json.JSONModel({ items: aCombinedData });
                            this.getView().setModel(oHistoryModel, "historyModel");
        
                            this._oBusy.close();
                        })
                        .catch(oError => {
                            console.error("Error combining data:", oError);
                            sap.m.MessageBox.error("Failed to load employee details.");
                            this._oBusy.close();
                        });
                }.bind(this),
                error: function (oError) {
                    console.error("Error loading RequestSet:", oError);
                    sap.m.MessageBox.error("Failed to load request data.");
                    this._oBusy.close();
                }.bind(this)
            });
        },

        // _getInitialData: function () {
        //     var that = this;
        //     var oModel = this.getView().getModel();
        //     this._oBusy.open();
            
        //     // Retrieve data from RequestSet
        //     oModel.read("/RequestSet", {
        //         success: function (oRequestData) {
        //             console.log("RequestSet data retrieved successfully:", oRequestData);

        //             // Retrieve data from EmployeeDetailSet for each employee in RequestSet
        //             let aPromises = oRequestData.results.map(request => {
        //                 return new Promise((resolve, reject) => {
        //                     oModel.read(`/EmployeeDetailSet('${request.EmployeeNumber}')`, {
        //                         success: function (oEmployeeData) {
        //                             resolve({
        //                                 ...request,
        //                                 EmployeeName: oEmployeeData.EmployeeName,
        //                                 DivisionText: oEmployeeData.DivisionText,
        //                                 ActionType: oEmployeeData.ActionType,
        //                                 ActionTypeDesc: oEmployeeData.ActionTypeDesc,
        //                                 EmployeePositionLongtext: oEmployeeData.EmployeePositionLongtext
        //                             });
        //                         },
        //                         error: function (oError) {
        //                             reject(oError);
        //                         }
        //                     });
        //                 });
        //             });

        //             // Wait for all promises to resolve
        //             Promise.all(aPromises).then(aCombinedData => {
        //                 that._oHistoryModel.setData({
        //                     items: aCombinedData
        //                 });
        //                 that._oBusy.close();
        //             }).catch(oError => {
        //                 console.error("Error retrieving EmployeeDetailSet data:", oError);
        //                 MessageBox.error("Failed to load employee data");
        //                 that._oBusy.close();
        //             });
        //         },
        //         error: function (oError) {
        //             console.error("Error retrieving RequestSet data:", oError);
        //             MessageBox.error("Failed to load request data");
        //             that._oBusy.close();
        //         }
        //     });
        // },

        onNavBack: function () {
            var oHistory = sap.ui.core.routing.History.getInstance();
            var sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
                oRouter.navTo("orgchart", {}, true);
            }
        }
        
    });
});