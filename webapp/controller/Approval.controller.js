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

    return BaseController.extend("bsim.hcmapp.man.movement.controller.Approval", {
        formatter: formatter,

        onInit: function () {
            this._oView = this.getView();
            this._oComponent = this.getOwnerComponent();
            this._oView.addStyleClass(this._oComponent.getContentDensityClass());
            
            this._oBusy = new sap.m.BusyDialog();
            this._currentUser();
            this._oHistoryModel = new JSONModel();
            this.getView().setModel(this._oHistoryModel, "approvalModel");
            this.getRouter().getRoute("approval").attachPatternMatched(this._onApprovalRouteMatched, this);
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

        onEmployeeApprovalPressed: function (oEvent) {
            const oItem = oEvent.getSource();
            const oContext = oItem.getBindingContext("approvalModel");
        
            if (!oContext) {
                console.error("No binding context found for the selected item.");
                return;
            }
        
            const oSelectedData = oContext.getObject(); // Get the full object
            console.log("Selected Item Data:", oSelectedData); // Debugging statement
        
            const sRequestId = oSelectedData.RequestId; // Ensure RequestId exists
        
            if (!sRequestId) {
                console.error("No RequestId found in the selected item data.");
                return;
            }
        
            console.log("Navigating to detail approval with RequestId:", sRequestId);
        
            const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("detailapproval", {
                RequestId: sRequestId
            });
        },

        // onEmployeeApprovalPressed: function (oEvent) {
        //     const oItem = oEvent.getSource();
        //     const oContext = oItem.getBindingContext("approvalModel");
        
        //     if (!oContext) {
        //         console.error("No binding context found for the selected item.");
        //         return;
        //     }
        
        //     const oSelectedData = oContext.getObject(); // Get the full object
        //     console.log("Selected Item Data:", oSelectedData); // Debugging statement
        
        //     const sRequestId = oSelectedData.RequestId; // Ensure RequestId exists
        //     const sEmployeeNumber = oSelectedData.EmployeeNumber; // Ensure EmployeeNumber exists
        
        //     if (!sRequestId || !sEmployeeNumber) {
        //         console.error("No RequestId or EmployeeNumber found in the selected item data.");
        //         return;
        //     }
        
        //     console.log("Navigating to detail approval with RequestId:", sRequestId);
        
        //     const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        //     oRouter.navTo("detailapproval", {
        //         RequestId: sRequestId
        //     });
        // },

        // onEmployeeApprovalPressed: function (oEvent) {
        //     var oItem = oEvent.getSource();
        //     var oContext = oItem.getBindingContext("approvalModel");
        //     var sRequestId = oContext.getProperty("RequestId");

        //     if (!sRequestId) {
        //         console.error("No Employee Number found in node data");
        //         return;
        //     }

        //     console.log("Navigating to detail approval with request id:", sRequestId);

        //     var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        //     oRouter.navTo("detailapproval", {
        //         RequestId: sRequestId
        //     });
        // },

        _onApprovalRouteMatched: function (t) {
            this._getInitialData();
        },

        _currentUser: function () {
            return new Promise((resolve, reject) => {
                // Show busy indicator
                this._oBusy.open();
        
                var oDataModel = this.getOwnerComponent().getModel(); // Get the default OData model
        
                if (!oDataModel) {
                    console.error("OData model not available");
                    this._oBusy.close();
                    MessageBox.error("System error: OData model not available");
                    reject(new Error("OData model not available"));
                    return;
                }
        
                // Call the EmployeeDetailSet endpoint to get logged-in user details
                oDataModel.read("/EmployeeDetailSet", {
                    success: function (oData) {
                        console.log("Current user data received:", oData);
        
                        if (!oData || !oData.results || oData.results.length === 0) {
                            this._oBusy.close();
                            MessageBox.error("No user data received from server");
                            reject(new Error("No user data received from server"));
                            return;
                        }
        
                        // Get the first user from the results
                        var oCurrentUser = oData.results[0];
        
                        // Store the employee ID for later use
                        this._sEmployeeId = oCurrentUser.EmployeeNumber;
        
                        // Create a model for current user details
                        var oCurrentUserModel = new sap.ui.model.json.JSONModel(oCurrentUser);
                        this.getView().setModel(oCurrentUserModel, "currentUser");
        
                        this._oBusy.close();
                        resolve(oCurrentUser); // Resolve the Promise with the current user data
                    }.bind(this),
                    error: function (oError) {
                        this._oBusy.close();
                        console.error("Error fetching current user data:", oError);
                        MessageBox.error(
                            "Failed to load user details: " +
                            (oError.responseText ? JSON.parse(oError.responseText).error.message.value : "Unknown error")
                        );
                        reject(oError); // Reject the Promise with the error
                    }.bind(this)
                });
            });
        },

        _getInitialData: function () {
            const oDataModel = this.getOwnerComponent().getModel();
        
            if (!oDataModel) {
                console.error("OData model not available");
                return;
            }
        
            this._oBusy.open();
        
            // Get the logged-in user's employee number
            this._currentUser()
                .then(oCurrentUser => {
                    const sLoggedInEmployeeId = oCurrentUser.EmployeeNumber;
                    console.log("Logged-in Employee ID:", sLoggedInEmployeeId);
        
                    // Fetch data from /ApprovalListSet
                    oDataModel.read("/ApprovalListSet", {
                        urlParameters: {
                            "$filter": `ApproverId eq '${sLoggedInEmployeeId}'`
                        },
                        success: function (oApprovalData) {
                            console.log("ApprovalListSet loaded:", oApprovalData);
        
                            if (!oApprovalData.results || oApprovalData.results.length === 0) {
                                console.warn("No approval requests found in ApprovalListSet.");
                                sap.m.MessageBox.information("No approval requests found.");
                                this._oBusy.close();
                                return;
                            }
        
                            // Fetch data from /RequestSet and /EmployeeDetailSet for each RequestId
                            const aPromises = oApprovalData.results.map(approval => {
                                return new Promise((resolve, reject) => {
                                    const sRequestPath = `/RequestSet(guid'${approval.RequestId}')`;
                                    oDataModel.read(sRequestPath, {
                                        success: function (oRequestData) {
                                            console.log("RequestSet data loaded for RequestId:", approval.RequestId, oRequestData);
        
                                            // Fetch EmployeeDetailSet for the EmployeeNumber
                                            const sEmployeePath = `/EmployeeDetailSet('${oRequestData.EmployeeNumber}')`;
                                            oDataModel.read(sEmployeePath, {
                                                success: function (oEmployeeData) {
                                                    console.log("EmployeeDetailSet data loaded for EmployeeNumber:", oRequestData.EmployeeNumber, oEmployeeData);
        
                                                    resolve({
                                                        RequestId: approval.RequestId,
                                                        EmployeeNumber: oRequestData.EmployeeNumber,
                                                        EmployeeName: oEmployeeData.EmployeeName || oRequestData.EmployeeName,
                                                        DivisionText: oEmployeeData.DivisionText,
                                                        ActionType: oEmployeeData.ActionType,
                                                        ActionTypeDesc: oEmployeeData.ActionTypeDesc,
                                                        PlansDesc_Dest: oRequestData.PlansDesc_Dest,
                                                        MassgDesc: oRequestData.MassgDesc,
                                                        ZbegdaEfktf: oRequestData.ZbegdaEfktf,
                                                        CreatedOn: oRequestData.CreatedOn,
                                                        StatusText: oRequestData.StatusText,
                                                        ApproverName: approval.ApproverName,
                                                        Status: approval.Status
                                                    });
                                                },
                                                error: function (oError) {
                                                    console.error(`Error loading EmployeeDetailSet for EmployeeNumber ${oRequestData.EmployeeNumber}:`, oError);
                                                    reject(oError);
                                                }
                                            });
                                        },
                                        error: function (oError) {
                                            console.error(`Error loading RequestSet for RequestId ${approval.RequestId}:`, oError);
                                            reject(oError);
                                        }
                                    });
                                });
                            });
        
                            // Wait for all promises to resolve
                            Promise.all(aPromises)
                                .then(aCombinedData => {
                                    console.log("Combined data:", aCombinedData);
        
                                    // Set the combined data to the approvalModel
                                    const oApprovalModel = new sap.ui.model.json.JSONModel({ items: aCombinedData });
                                    this.getView().setModel(oApprovalModel, "approvalModel");
        
                                    this._oBusy.close();
                                })
                                .catch(oError => {
                                    console.error("Error combining data:", oError);
                                    sap.m.MessageBox.error("Failed to load combined data.");
                                    this._oBusy.close();
                                });
                        }.bind(this),
                        error: function (oError) {
                            console.error("Error loading ApprovalListSet:", oError);
                            sap.m.MessageBox.error("Failed to load approval data.");
                            this._oBusy.close();
                        }.bind(this)
                    });
                })
                .catch(oError => {
                    console.error("Error retrieving current user:", oError);
                    sap.m.MessageBox.error("Failed to retrieve logged-in user details.");
                    this._oBusy.close();
                });
        },

        // _getInitialData: function () {
        //     const oDataModel = this.getOwnerComponent().getModel();
        
        //     if (!oDataModel) {
        //         console.error("OData model not available");
        //         return;
        //     }
        
        //     this._oBusy.open();
        
        //     // Get the logged-in user's employee number
        //     this._currentUser()
        //         .then(oCurrentUser => {
        //             const sLoggedInEmployeeId = oCurrentUser.EmployeeNumber;
        //             console.log("Logged-in Employee ID:", sLoggedInEmployeeId);
        
        //             // Fetch data from /ApprovalListSet
        //             oDataModel.read("/ApprovalListSet", {
        //                 urlParameters: {
        //                     "$filter": `ApproverId eq '${sLoggedInEmployeeId}'`
        //                 },
        //                 success: function (oApprovalData) {
        //                     console.log("ApprovalListSet loaded:", oApprovalData);
        
        //                     if (!oApprovalData.results || oApprovalData.results.length === 0) {
        //                         console.warn("No approval requests found in ApprovalListSet.");
        //                         sap.m.MessageBox.information("No approval requests found.");
        //                         this._oBusy.close();
        //                         return;
        //                     }
        
        //                     // Fetch data from /RequestSet for each RequestId
        //                     const aPromises = oApprovalData.results.map(approval => {
        //                         return new Promise((resolve, reject) => {
        //                             const sRequestPath = `/RequestSet(guid'${approval.RequestId}')`;
        //                             oDataModel.read(sRequestPath, {
        //                                 success: function (oRequestData) {
        //                                     console.log("RequestSet data loaded for RequestId:", approval.RequestId, oRequestData);
        
        //                                     resolve({
        //                                         RequestId: approval.RequestId,
        //                                         EmployeeName: oRequestData.EmployeeName,
        //                                         ActionType: oRequestData.ActionType,
        //                                         ReasonForAction: oRequestData.MassgDesc, // Assuming MassgDesc is the reason for action
        //                                         DateAction: oRequestData.ZbegdaEfktf, // Assuming ZbegdaEfktf is the date of action
        //                                         DateRequest: oRequestData.CreatedOn, // Assuming CreatedOn is the date of request
        //                                         ApproverName: approval.ApproverName,
        //                                         Status: approval.Status,
        //                                         StatusText: approval.StatusText
        //                                     });
        //                                 },
        //                                 error: function (oError) {
        //                                     console.error(`Error loading RequestSet for RequestId ${approval.RequestId}:`, oError);
        //                                     reject(oError);
        //                                 }
        //                             });
        //                         });
        //                     });
        
        //                     // Wait for all promises to resolve
        //                     Promise.all(aPromises)
        //                         .then(aCombinedData => {
        //                             console.log("Combined data:", aCombinedData);
        
        //                             // Set the combined data to the approvalModel
        //                             const oApprovalModel = new sap.ui.model.json.JSONModel({ items: aCombinedData });
        //                             this.getView().setModel(oApprovalModel, "approvalModel");
        
        //                             this._oBusy.close();
        //                         })
        //                         .catch(oError => {
        //                             console.error("Error combining data:", oError);
        //                             sap.m.MessageBox.error("Failed to load combined data.");
        //                             this._oBusy.close();
        //                         });
        //                 }.bind(this),
        //                 error: function (oError) {
        //                     console.error("Error loading ApprovalListSet:", oError);
        //                     sap.m.MessageBox.error("Failed to load approval data.");
        //                     this._oBusy.close();
        //                 }.bind(this)
        //             });
        //         })
        //         .catch(oError => {
        //             console.error("Error retrieving current user:", oError);
        //             sap.m.MessageBox.error("Failed to retrieve logged-in user details.");
        //             this._oBusy.close();
        //         });
        // },

        // _getInitialData: function () {
        //     const oDataModel = this.getOwnerComponent().getModel();
        
        //     if (!oDataModel) {
        //         console.error("OData model not available");
        //         return;
        //     }
        
        //     this._oBusy.open();
        
        //     // Get the logged-in user's employee number
        //     this._currentUser()
        //         .then(oCurrentUser => {
        //             const sLoggedInEmployeeId = oCurrentUser.EmployeeNumber;
        //             console.log("Logged-in Employee ID:", sLoggedInEmployeeId);
        
        //             // Fetch data from /ApprovalListSet
        //             oDataModel.read("/ApprovalListSet", {
        //                 urlParameters: {
        //                     "$filter": `ApproverId eq '${sLoggedInEmployeeId}'`
        //                 },
        //                 success: function (oApprovalData) {
        //                     console.log("ApprovalListSet loaded:", oApprovalData);
        
        //                     if (!oApprovalData.results || oApprovalData.results.length === 0) {
        //                         console.warn("No approval requests found in ApprovalListSet.");
        //                         sap.m.MessageBox.information("No approval requests found.");
        //                         this._oBusy.close();
        //                         return;
        //                     }
        
        //                     // Map the approval data to a format suitable for the view
        //                     const aMappedData = oApprovalData.results.map(approval => ({
        //                         RequestId: approval.RequestId,
        //                         SequenceNumber: approval.SequenceNumber,
        //                         ApproverId: approval.ApproverId,
        //                         ApproverName: approval.ApproverName,
        //                         Abbreviation: approval.Abbreviation,
        //                         Status: approval.Status,
        //                         StatusText: approval.StatusText,
        //                         ApprovalDate: approval.ApprovalDate,
        //                         ApprovalUser: approval.ApprovalUser,
        //                         ApprovalTime: approval.ApprovalTime,
        //                         Notes: approval.Notes
        //                     }));
        
        //                     console.log("Mapped Approval Data:", aMappedData);
        
        //                     // Set the data to the approvalModel
        //                     const oApprovalModel = new sap.ui.model.json.JSONModel({ items: aMappedData });
        //                     this.getView().setModel(oApprovalModel, "approvalModel");
        
        //                     this._oBusy.close();
        //                 }.bind(this),
        //                 error: function (oError) {
        //                     console.error("Error loading ApprovalListSet:", oError);
        
        //                     // Parse the error response for meaningful feedback
        //                     let sErrorMessage = "Failed to load approval data.";
        //                     try {
        //                         const oErrorResponse = JSON.parse(oError.responseText);
        //                         if (oErrorResponse.error && oErrorResponse.error.message) {
        //                             sErrorMessage = oErrorResponse.error.message.value || sErrorMessage;
        //                         }
        //                     } catch (e) {
        //                         console.error("Error parsing error response:", e);
        //                     }
        
        //                     sap.m.MessageBox.error(sErrorMessage);
        //                     this._oBusy.close();
        //                 }.bind(this)
        //             });
        //         })
        //         .catch(oError => {
        //             console.error("Error retrieving current user:", oError);
        //             sap.m.MessageBox.error("Failed to retrieve logged-in user details.");
        //             this._oBusy.close();
        //         });
        // },

        // _getInitialData: function () {
        //     const oDataModel = this.getOwnerComponent().getModel();
        
        //     if (!oDataModel) {
        //         console.error("OData model not available");
        //         return;
        //     }
        
        //     this._oBusy.open();
        
        //     // Get the logged-in user's employee number
        //     this._currentUser()
        //         .then(oCurrentUser => {
        //             const sLoggedInEmployeeId = oCurrentUser.EmployeeNumber;
        //             console.log("Logged-in Employee ID:", sLoggedInEmployeeId);
        
        //             // Fetch data from /ApprovalListSet
        //             const oApprovalListPromise = new Promise((resolve, reject) => {
        //                 oDataModel.read("/ApprovalListSet", {
        //                     urlParameters: {
        //                         "$filter": `ApproverId eq '${sLoggedInEmployeeId}'`
        //                     },
        //                     success: function (oApprovalData) {
        //                         console.log("ApprovalListSet loaded:", oApprovalData);
        //                         resolve(oApprovalData.results || []);
        //                     },
        //                     error: function (oError) {
        //                         console.error("Error loading ApprovalListSet:", oError);
        //                         reject(oError);
        //                     }
        //                 });
        //             });
        
        //             // Fetch data from /RequestSet
        //             const oRequestSetPromise = new Promise((resolve, reject) => {
        //                 oDataModel.read("/RequestSet", {
        //                     urlParameters: { "$expand": "toApproval" },
        //                     success: function (oRequestData) {
        //                         console.log("RequestSet loaded:", oRequestData);
        //                         resolve(oRequestData.results || []);
        //                     },
        //                     error: function (oError) {
        //                         console.error("Error loading RequestSet:", oError);
        //                         reject(oError);
        //                     }
        //                 });
        //             });
        
        //             // Combine data from both entities and fetch EmployeeDetailSet
        //             Promise.all([oApprovalListPromise, oRequestSetPromise])
        //                 .then(([aApprovalListData, aRequestSetData]) => {
        //                     console.log("ApprovalListSet Data:", aApprovalListData);
        //                     console.log("RequestSet Data:", aRequestSetData);
        
        //                     // Fetch EmployeeDetailSet for each EmployeeNumber in RequestSet
        //                     const aEmployeePromises = aRequestSetData.map(request => {
        //                         return new Promise((resolve, reject) => {
        //                             oDataModel.read(`/EmployeeDetailSet('${request.EmployeeNumber}')`, {
        //                                 success: function (oEmployeeData) {
        //                                     resolve({
        //                                         RequestId: request.RequestId,
        //                                         EmployeeNumber: request.EmployeeNumber,
        //                                         EmployeeName: oEmployeeData.EmployeeName || request.EmployeeName,
        //                                         DivisionText: oEmployeeData.DivisionText,
        //                                         ActionType: oEmployeeData.ActionType,
        //                                         ActionTypeDesc: oEmployeeData.ActionTypeDesc,
        //                                         PlansDesc_Dest: request.PlansDesc_Dest,
        //                                         MassgDesc: request.MassgDesc,
        //                                         ZbegdaEfktf: request.ZbegdaEfktf,
        //                                         CreatedOn: request.CreatedOn,
        //                                         StatusText: request.StatusText
        //                                     });
        //                                 },
        //                                 error: function (oError) {
        //                                     console.error(`Error loading EmployeeDetailSet for EmployeeNumber ${request.EmployeeNumber}:`, oError);
        //                                     reject(oError);
        //                                 }
        //                             });
        //                         });
        //                     });
        
        //                     // Wait for all EmployeeDetailSet promises to resolve
        //                     Promise.all(aEmployeePromises)
        //                         .then(aEmployeeData => {
        //                             console.log("EmployeeDetailSet Data:", aEmployeeData);
        
        //                             // Combine ApprovalListSet and EmployeeDetailSet data
        //                             const aCombinedData = aApprovalListData.map(approval => {
        //                                 const oEmployee = aEmployeeData.find(employee => employee.RequestId === approval.RequestId);
        //                                 return {
        //                                     RequestId: approval.RequestId,
        //                                     SequenceNumber: approval.SequenceNumber,
        //                                     ApproverId: approval.ApproverId,
        //                                     ApproverName: approval.ApproverName,
        //                                     Abbreviation: approval.Abbreviation,
        //                                     Status: approval.Status,
        //                                     StatusText: approval.StatusText,
        //                                     ApprovalDate: approval.ApprovalDate,
        //                                     ApprovalUser: approval.ApprovalUser,
        //                                     ApprovalTime: approval.ApprovalTime,
        //                                     Notes: approval.Notes,
        //                                     EmployeeNumber: oEmployee ? oEmployee.EmployeeNumber : "N/A",
        //                                     EmployeeName: oEmployee ? oEmployee.EmployeeName : "Unknown",
        //                                     DivisionText: oEmployee ? oEmployee.DivisionText : "N/A",
        //                                     ActionType: oEmployee ? oEmployee.ActionType : "N/A",
        //                                     ActionTypeDesc: oEmployee ? oEmployee.ActionTypeDesc : "N/A",
        //                                     PlansDesc_Dest: oEmployee ? oEmployee.PlansDesc_Dest : "N/A",
        //                                     MassgDesc: oEmployee ? oEmployee.MassgDesc : "N/A",
        //                                     ZbegdaEfktf: oEmployee ? oEmployee.ZbegdaEfktf : "N/A",
        //                                     CreatedOn: oEmployee ? oEmployee.CreatedOn : "N/A"
        //                                 };
        //                             });
        
        //                             console.log("Combined Data:", aCombinedData);
        
        //                             // Set the combined data to the approvalModel
        //                             const oApprovalModel = new sap.ui.model.json.JSONModel({ items: aCombinedData });
        //                             this.getView().setModel(oApprovalModel, "approvalModel");
        
        //                             this._oBusy.close();
        //                         })
        //                         .catch(oError => {
        //                             console.error("Error combining EmployeeDetailSet data:", oError);
        //                             sap.m.MessageBox.error("Failed to load employee details.");
        //                             this._oBusy.close();
        //                         });
        //                 })
        //                 .catch(oError => {
        //                     console.error("Error combining data from ApprovalListSet and RequestSet:", oError);
        //                     sap.m.MessageBox.error("Failed to load approval and request data.");
        //                     this._oBusy.close();
        //                 });
        //         })
        //         .catch(oError => {
        //             console.error("Error retrieving current user:", oError);
        //             sap.m.MessageBox.error("Failed to retrieve logged-in user details.");
        //             this._oBusy.close();
        //         });
        // },

        // _getInitialData: function () {
        //     const oDataModel = this.getOwnerComponent().getModel();
        
        //     if (!oDataModel) {
        //         console.error("OData model not available");
        //         return;
        //     }
        
        //     this._oBusy.open();
        
        //     // Get the logged-in user's employee number
        //     this._currentUser()
        //         .then(oCurrentUser => {
        //             const sLoggedInEmployeeId = oCurrentUser.EmployeeNumber;
        //             console.log("Logged-in Employee ID:", sLoggedInEmployeeId);
        
        //             // Fetch data from /ApprovalListSet for the logged-in user
        //             oDataModel.read("/ApprovalListSet", {
        //                 urlParameters: {
        //                     "$filter": `ApproverId eq '${sLoggedInEmployeeId}'`
        //                 },
        //                 success: function (oApprovalData) {
        //                     console.log("ApprovalListSet loaded:", oApprovalData);
        
        //                     if (!oApprovalData.results || oApprovalData.results.length === 0) {
        //                         console.warn("No approval requests found for the logged-in user.");
        //                         sap.m.MessageBox.information("No approval requests found for your user.");
        //                         this._oBusy.close();
        //                         return;
        //                     }
        
        //                     // Map the approval data to a format suitable for the view
        //                     const aMappedData = oApprovalData.results.map(approval => ({
        //                         RequestId: approval.RequestId,
        //                         SequenceNumber: approval.SequenceNumber,
        //                         ApproverId: approval.ApproverId,
        //                         ApproverName: approval.ApproverName,
        //                         Abbreviation: approval.Abbreviation,
        //                         Status: approval.Status,
        //                         StatusText: approval.StatusText,
        //                         ApprovalDate: approval.ApprovalDate,
        //                         ApprovalUser: approval.ApprovalUser,
        //                         ApprovalTime: approval.ApprovalTime,
        //                         Notes: approval.Notes
        //                     }));
        
        //                     console.log("Mapped Approval Data:", aMappedData);
        
        //                     // Set the data to the approvalModel
        //                     const oApprovalModel = new sap.ui.model.json.JSONModel({ items: aMappedData });
        //                     this.getView().setModel(oApprovalModel, "approvalModel");
        
        //                     this._oBusy.close();
        //                 }.bind(this),
        //                 error: function (oError) {
        //                     console.error("Error loading ApprovalListSet:", oError);
        
        //                     // Parse the error response for meaningful feedback
        //                     let sErrorMessage = "Failed to load approval data.";
        //                     try {
        //                         const oErrorResponse = JSON.parse(oError.responseText);
        //                         if (oErrorResponse.error && oErrorResponse.error.message) {
        //                             sErrorMessage = oErrorResponse.error.message.value || sErrorMessage;
        //                         }
        //                     } catch (e) {
        //                         console.error("Error parsing error response:", e);
        //                     }
        
        //                     sap.m.MessageBox.error(sErrorMessage);
        //                     this._oBusy.close();
        //                 }.bind(this)
        //             });
        //         })
        //         .catch(oError => {
        //             console.error("Error retrieving current user:", oError);
        //             sap.m.MessageBox.error("Failed to retrieve logged-in user details.");
        //             this._oBusy.close();
        //         });
        // },

        // fix
        // _getInitialData: function () {
        //     const oDataModel = this.getOwnerComponent().getModel();
        
        //     if (!oDataModel) {
        //         console.error("OData model not available");
        //         return;
        //     }
        
        //     this._oBusy.open();
        
        //     // Fetch data from /RequestSet
        //     oDataModel.read("/RequestSet", {
        //         urlParameters: { "$expand": "toApproval" }, // Expand the toApproval navigation property
        //         success: function (oRequestData) {
        //             console.log("RequestSet loaded:", oRequestData);

        //             if (!oRequestData.results || oRequestData.results.length === 0) {
        //                 console.warn("No approval requests found for the logged-in user.");
        //             }
        
        //             // Fetch data from /EmployeeDetailSet for each employee in RequestSet
        //             const aPromises = oRequestData.results.map(request => {
        //                 return new Promise((resolve, reject) => {
        //                     // Fetch EmployeeDetailSet
        //                     oDataModel.read(`/EmployeeDetailSet('${request.EmployeeNumber}')`, {
        //                         success: function (oEmployeeData) {
        //                             // Fetch ApproverName from toApproval
        //                             const sRequestPath = `/RequestSet(guid'${request.RequestId}')/toApproval`;
        //                             oDataModel.read(sRequestPath, {
        //                                 success: function (oApprovalData) {
        //                                     console.log("Approval Data:", oApprovalData); 
        //                                     resolve({
        //                                         RequestId: request.RequestId,
        //                                         EmployeeNumber: request.EmployeeNumber,
        //                                         EmployeeName: oEmployeeData.EmployeeName || request.EmployeeName,
        //                                         DivisionText: oEmployeeData.DivisionText,
        //                                         ActionType: oEmployeeData.ActionType,
        //                                         ActionTypeDesc: oEmployeeData.ActionTypeDesc,
        //                                         Massg: request.Massg,
        //                                         PlansDesc_Dest: request.PlansDesc_Dest,
        //                                         MassgDesc: request.MassgDesc,
        //                                         ZbegdaEfktf: request.ZbegdaEfktf,
        //                                         CreatedOn: request.CreatedOn,
        //                                         StatusText: request.StatusText,
        //                                         ApproverName: oApprovalData.results && oApprovalData.results.length > 0 ? oApprovalData.results[0].ApproverName : "",
        //                                         ApproverId: oApprovalData.results && oApprovalData.results.length > 0 ? oApprovalData.results[0].ApproverId : "",
        //                                         Abbreviation: oApprovalData.results && oApprovalData.results.length > 0 ? oApprovalData.results[0].Abbreviation : ""
        //                                     });
        //                                 },
        //                                 error: function (oError) {
        //                                     console.error(`Error loading toApproval for RequestId ${request.RequestId}:`, oError);
        //                                     reject(oError);
        //                                 }
        //                             });
        //                         },
        //                         error: function (oError) {
        //                             console.error(`Error loading EmployeeDetailSet for EmployeeNumber ${request.EmployeeNumber}:`, oError);
        //                             reject(oError);
        //                         }
        //                     });
        //                 });
        //             });
        
        //             // Wait for all promises to resolve
        //             Promise.all(aPromises)
        //                 .then(aCombinedData => {
        //                     console.log("Combined data:", aCombinedData);
        
        //                     // Set the combined data to the historyModel
        //                     const oApprovalModel = new sap.ui.model.json.JSONModel({ items: aCombinedData });
        //                     this.getView().setModel(oApprovalModel, "approvalModel");
        
        //                     this._oBusy.close();
        //                 })
        //                 .catch(oError => {
        //                     console.error("Error combining data:", oError);
        //                     sap.m.MessageBox.error("Failed to load employee details.");
        //                     this._oBusy.close();
        //                 });
        //         }.bind(this),
        //         error: function (oError) {
        //             console.error("Error loading RequestSet:", oError);
        //             sap.m.MessageBox.error("Failed to load request data.");
        //             this._oBusy.close();
        //         }.bind(this)
        //     });
        // },
               
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
                oRouter.navTo("overview", {}, true);
            }
        }

    });
});