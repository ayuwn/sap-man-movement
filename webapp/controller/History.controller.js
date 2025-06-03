sap.ui.define([
    "bsim/hcmapp/man/movement/controller/BaseController",
    "bsim/hcmapp/man/movement/utils/formatter",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment",
    "sap/ushell/services/UserInfo",
    "sap/ui/export/library",
    "sap/ui/export/Spreadsheet"
], function (BaseController, formatter, JSONModel, MessageBox, Filter, FilterOperator, Fragment, UserInfo, exportLibrary, Spreadsheet) {
    "use strict";
    var EdmType = exportLibrary.EdmType;

    return BaseController.extend("bsim.hcmapp.man.movement.controller.History", {
        formatter: formatter,

        onInit: function () {
            this._oView = this.getView();
            this._oComponent = this.getOwnerComponent();
            this._oView.addStyleClass(this._oComponent.getContentDensityClass());
            this._oBusy = new sap.m.BusyDialog();
            this._currentUser();
            this._oHistoryModel = new JSONModel();
            this.getView().setModel(this._oHistoryModel, "historyModel");
            this.getRouter().getRoute("history").attachPatternMatched(this._onHistoryRouteMatched, this);
        },

        createColumnConfig: function() {
            var aCols = [];
            aCols.push({ label: "Employee Number", property: "EmployeeNumber", type: EdmType.String });
            aCols.push({ label: "Employee Name", property: "EmployeeName", type: EdmType.String });
            aCols.push({ label: "Action Type", property: "ActionType", type: EdmType.String });
            aCols.push({ label: "Action Type Desc", property: "ActionTypeDesc", type: EdmType.String });
            aCols.push({ label: "Action Reason", property: "MassgDesc", type: EdmType.String });
            aCols.push({ label: "Date Action", property: "ZbegdaEfktf", type: EdmType.Date });
            aCols.push({ label: "Date Request", property: "CreatedOn", type: EdmType.Date });
            aCols.push({ label: "Status", property: "StatusText", type: EdmType.String });
            aCols.push({ label: "Person Responsible", property: "ApproverName", type: EdmType.String });
            return aCols;
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

        // onEmployeePressed: function (oEvent) {
        //     var oItem = oEvent.getSource();
        //     var oContext = oItem.getBindingContext("historyModel");
        //     var sRequestId = oContext.getProperty("RequestId");

        //     if (!sRequestId) {
        //         console.error("No Employee Number found in node data");
        //         return;
        //     }

        //     console.log("Navigating to detail history with request id:", sRequestId);

        //     var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        //     oRouter.navTo("detailhistory", {
        //         RequestId: sRequestId
        //     });
        // },

        onEmployeePressed: function (oEvent) {
            var oItem = oEvent.getSource();
            var oContext = oItem.getBindingContext("historyModel");
            var sRequestId = oContext.getProperty("RequestId");
        
            if (!sRequestId) {
                console.error("No Request ID found in node data");
                return;
            }
        
            console.log("Navigating to detail history with request id:", sRequestId);
        
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        
            // Define the OData models
            const aODataModels = [
                { model: this.getOwnerComponent().getModel(), name: "Default" },
                { model: this.getOwnerComponent().getModel("Promotion"), name: "Promotion" },
                { model: this.getOwnerComponent().getModel("StatusChange"), name: "StatusChange" },
                { model: this.getOwnerComponent().getModel("Assignment"), name: "Assignment" },
                { model: this.getOwnerComponent().getModel("Demotion"), name: "Demotion" },
                { model: this.getOwnerComponent().getModel("Acting"), name: "Acting" },
            ];
        
            // Function to fetch data from a model
            const fetchData = (oModel, modelName) => {
                return new Promise((resolve, reject) => {
                    if (!oModel) {
                        console.warn(`OData model ${modelName} not available.`);
                        resolve(null);
                        return;
                    }
        
                    const sRequestPath = `/RequestSet(guid'${sRequestId}')`;
                    oModel.read(sRequestPath, {
                        success: function (oRequestData) {
                            console.log(`RequestSet data retrieved successfully from ${modelName}:`, oRequestData);
                            resolve({ data: oRequestData, modelName });
                        },
                        error: function (oError) {
                            console.error(`Error retrieving RequestSet data from ${modelName}:`, oError);
                            resolve(null); // Resolve with null to continue processing other models
                        }
                    });
                });
            };
        
            // Fetch data from all models
            const aPromises = aODataModels.map(({ model, name }) => fetchData(model, name));
        
            Promise.all(aPromises)
                .then((aResults) => {
                    // Find the first valid result
                    const oResult = aResults.find(result => result !== null);
        
                    if (!oResult) {
                        console.error("No valid data found for the given RequestId.");
                        sap.m.MessageBox.error("Failed to retrieve data for the selected request.");
                        return;
                    }
        
                    const { data: oRequestData, modelName } = oResult;
        
                    // Check if the model is "StatusChange"
                    if (modelName === "StatusChange") {
                        console.log("Model is StatusChange. Navigating to detailhistorystatuschange.");
                        oRouter.navTo("detailhistorystatuschange", {
                            RequestId: sRequestId
                        });
                    } else if (modelName === "Demotion") {
                        console.log("Model is Demotion. Navigating to detailhistorydem.");
                        oRouter.navTo("detailhistorydem", {
                            RequestId: sRequestId
                        });
                    } else if (modelName === "Promotion") {
                        console.log("Model is Promotion. Navigating to detailhistoryprom.");
                        oRouter.navTo("detailhistoryprom", {
                            RequestId: sRequestId
                        });
                    } else if (modelName === "Assignment") {
                        console.log("Model is Assignment. Navigating to detailhistoryassign.");
                        oRouter.navTo("detailhistoryassign", {
                            RequestId: sRequestId
                        });
                    } else if (modelName === "Acting") {
                        console.log("Model is Acting. Navigating to detailhistoryacting.");
                        oRouter.navTo("detailhistoryacting", {
                            RequestId: sRequestId
                        });
                    } else {
                        console.log(`Model is ${modelName}. Navigating to detailhistory.`);
                        oRouter.navTo("detailhistorymov", {
                            RequestId: sRequestId
                        });
                    }
                })
                .catch((oError) => {
                    console.error("Error fetching data from OData models:", oError);
                    sap.m.MessageBox.error("Failed to fetch data from the services.");
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
            const aODataModels = [
                this.getOwnerComponent().getModel(),
                this.getOwnerComponent().getModel("Promotion"),
                this.getOwnerComponent().getModel("StatusChange"),
                this.getOwnerComponent().getModel("Assignment"),
                this.getOwnerComponent().getModel("Demotion"),
                this.getOwnerComponent().getModel("Acting"),
            ];

            this._oBusy.open();

            this._currentUser()
                .then(oCurrentUser => {
                    const sLoggedInEmployeeId = oCurrentUser.EmployeeNumber;
                    const bIsHR = oCurrentUser.IsHR === "X";
                    console.log("Logged-in Employee ID:", sLoggedInEmployeeId, "isHR:", bIsHR);

                    const aPromises = aODataModels.map(oModel => {
                        return new Promise((resolve, reject) => {
                            if (!oModel) {
                                console.warn("OData model not available for one of the services.");
                                resolve([]);
                                return;
                            }

                            const mReadParams = {
                                urlParameters: { "$expand": "toApproval" },
                                success: function (oRequestData) {
                                    let aFilteredResults = oRequestData.results;
                                    // If not HR, filter by EmployeeNumber or PicNumber
                                    if (!bIsHR) {
                                        aFilteredResults = aFilteredResults.filter(request =>
                                            request.EmployeeNumber === sLoggedInEmployeeId ||
                                            request.PicNumber === sLoggedInEmployeeId
                                        );
                                    }

                                    const aDetailPromises = aFilteredResults.map(request => {
                                        return new Promise((resolveDetail, rejectDetail) => {
                                            oModel.read(`/EmployeeDetailSet('${request.EmployeeNumber}')`, {
                                                success: function (oEmployeeData) {
                                                    const sRequestPath = `/RequestSet(guid'${request.RequestId}')/toApproval`;
                                                    oModel.read(sRequestPath, {
                                                        success: function (oApprovalData) {
                                                            const aApprovals = oApprovalData.results || [];
                                                            const oLatestApproval = aApprovals.length > 0 ? aApprovals[aApprovals.length - 1] : null;
                                                            let oRelevantApproval = null;

                                                            if (aApprovals.Status === "P") {
                                                                oRelevantApproval = oLatestApproval;
                                                            } else {
                                                                oRelevantApproval = aApprovals.length > 1 ? aApprovals[aApprovals.length - 1] : null;
                                                            }

                                                            resolveDetail({
                                                                RequestId: request.RequestId,
                                                                EmployeeNumber: request.EmployeeNumber,
                                                                EmployeeName: oEmployeeData.EmployeeName?.FormattedName || oEmployeeData.EmployeeName || request.EmployeeName,
                                                                DivisionText: oEmployeeData.DivisionText,
                                                                ActionType: oEmployeeData.ActionType,
                                                                ActionTypeDesc: oEmployeeData.ActionTypeDesc,
                                                                Massg: request.Massg,
                                                                PlansDesc_Dest: request.PlansDesc_Dest,
                                                                PositionName: oEmployeeData.PositionName,
                                                                MassgDesc: request.MassgDesc,
                                                                ZbegdaEfktf: request.ZbegdaEfktf,
                                                                ZenddaEfktf: request.ZenddaEfktf,
                                                                CreatedOn: request.CreatedOn,
                                                                StatusText: oRelevantApproval ? oRelevantApproval.StatusText : request.StatusText,
                                                                ApproverName: oLatestApproval ? oLatestApproval.ApproverName : "",
                                                                ApproverId: oLatestApproval ? oLatestApproval.ApproverId : "",
                                                                NoSK: request.NoSK,
                                                            });
                                                        },
                                                        error: function (oError) {
                                                            console.error("Error fetching approval data:", oError);
                                                            rejectDetail(oError);
                                                        }
                                                    });
                                                },
                                                error: function (oError) {
                                                    console.error("Error fetching employee data:", oError);
                                                    rejectDetail(oError);
                                                }
                                            });
                                        });
                                    });

                                    Promise.all(aDetailPromises)
                                        .then(resolve)
                                        .catch(reject);
                                },
                                error: function (oError) {
                                    console.error("Error loading RequestSet from service:", oError);
                                    resolve([]);
                                }
                            };

                            // Only add filter if not HR
                            if (!bIsHR) {
                                mReadParams.filters = [
                                    new sap.ui.model.Filter("PicNumber", sap.ui.model.FilterOperator.EQ, sLoggedInEmployeeId)
                                ];
                            }

                            oModel.read("/RequestSet", mReadParams);
                        });
                    });

                    Promise.all(aPromises)
                        .then(aResults => {
                            const aCombinedResults = aResults.flat();
                            console.log("Combined RequestSet Data:", aCombinedResults);

                            // Sort by CreatedOn descending (newest first)
                            aCombinedResults.sort(function(a, b) {
                                return new Date(b.CreatedOn) - new Date(a.CreatedOn);
                            });

                            const oHistoryModel = new sap.ui.model.json.JSONModel({ items: aCombinedResults });
                            this.getView().setModel(oHistoryModel, "historyModel");

                            this._oBusy.close();
                        })
                        .catch(oError => {
                            console.error("Error combining data from all services:", oError);
                            sap.m.MessageBox.error("Failed to load request data from all services.");
                            this._oBusy.close();
                        });
                })
                .catch(oError => {
                    console.error("Error retrieving current user:", oError);
                    sap.m.MessageBox.error("Failed to retrieve logged-in user details.");
                    this._oBusy.close();
                });
        },

        // added logic dm staff
        // _getInitialData: function () {
        //     const aODataModels = [
        //         this.getOwnerComponent().getModel(),
        //         this.getOwnerComponent().getModel("Promotion"),
        //         this.getOwnerComponent().getModel("StatusChange"),
        //         this.getOwnerComponent().getModel("Assignment"),
        //         this.getOwnerComponent().getModel("Demotion"),
        //         this.getOwnerComponent().getModel("Acting"),
        //     ];

        //     this._oBusy.open();

        //     this._currentUser()
        //         .then(oCurrentUser => {
        //             const sLoggedInEmployeeId = oCurrentUser.EmployeeNumber;
        //             const bIsHR = oCurrentUser.IsHR === "X";
        //             console.log("Logged-in Employee ID:", sLoggedInEmployeeId, "isHR:", bIsHR);

        //             // If user is HR, do not filter by PicNumber/EmployeeNumber
        //             const aPromises = aODataModels.map(oModel => {
        //                 return new Promise((resolve, reject) => {
        //                     if (!oModel) {
        //                         console.warn("OData model not available for one of the services.");
        //                         resolve([]);
        //                         return;
        //                     }

        //                     // Only add filter if not HR
        //                     const mReadParams = {
        //                         urlParameters: { "$expand": "toApproval" },
        //                         success: function (oRequestData) {
        //                             // If HR, show all. If not, filter by EmployeeNumber or PicNumber
        //                             let aFilteredResults = oRequestData.results;
        //                             if (!bIsHR) {
        //                                 aFilteredResults = aFilteredResults.filter(request =>
        //                                     request.EmployeeNumber === sLoggedInEmployeeId ||
        //                                     request.PicNumber === sLoggedInEmployeeId
        //                                 );
        //                             }

        //                             const aDetailPromises = aFilteredResults.map(request => {
        //                                 return new Promise((resolveDetail, rejectDetail) => {
        //                                     oModel.read(`/EmployeeDetailSet('${request.EmployeeNumber}')`, {
        //                                         success: function (oEmployeeData) {
        //                                             const sRequestPath = `/RequestSet(guid'${request.RequestId}')/toApproval`;
        //                                             oModel.read(sRequestPath, {
        //                                                 success: function (oApprovalData) {
        //                                                     const aApprovals = oApprovalData.results || [];
        //                                                     const oLatestApproval = aApprovals.length > 0 ? aApprovals[aApprovals.length - 1] : null;
        //                                                     let oRelevantApproval = null;

        //                                                     if (request.Status === "A7") {
        //                                                         oRelevantApproval = oLatestApproval;
        //                                                     } else {
        //                                                         oRelevantApproval = aApprovals.length > 1 ? aApprovals[aApprovals.length - 2] : null;
        //                                                     }

        //                                                     resolveDetail({
        //                                                         RequestId: request.RequestId,
        //                                                         EmployeeNumber: request.EmployeeNumber,
        //                                                         EmployeeName: oEmployeeData.EmployeeName || request.EmployeeName,
        //                                                         DivisionText: oEmployeeData.DivisionText,
        //                                                         ActionType: oEmployeeData.ActionType,
        //                                                         ActionTypeDesc: oEmployeeData.ActionTypeDesc,
        //                                                         Massg: request.Massg,
        //                                                         PlansDesc_Dest: request.PlansDesc_Dest,
        //                                                         MassgDesc: request.MassgDesc,
        //                                                         ZbegdaEfktf: request.ZbegdaEfktf,
        //                                                         ZenddaEfktf: request.ZenddaEfktf,
        //                                                         CreatedOn: request.CreatedOn,
        //                                                         StatusText: oRelevantApproval ? oRelevantApproval.StatusText : request.StatusText,
        //                                                         ApproverName: oLatestApproval ? oLatestApproval.ApproverName : ""
        //                                                     });
        //                                                 },
        //                                                 error: function (oError) {
        //                                                     console.error("Error fetching approval data:", oError);
        //                                                     rejectDetail(oError);
        //                                                 }
        //                                             });
        //                                         },
        //                                         error: function (oError) {
        //                                             console.error("Error fetching employee data:", oError);
        //                                             rejectDetail(oError);
        //                                         }
        //                                     });
        //                                 });
        //                             });

        //                             Promise.all(aDetailPromises)
        //                                 .then(resolve)
        //                                 .catch(reject);
        //                         },
        //                         error: function (oError) {
        //                             console.error("Error loading RequestSet from service:", oError);
        //                             resolve([]);
        //                         }
        //                     };

        //                     // Only add filter if not HR
        //                     if (!bIsHR) {
        //                         mReadParams.filters = [
        //                             new sap.ui.model.Filter("PicNumber", sap.ui.model.FilterOperator.EQ, sLoggedInEmployeeId)
        //                         ];
        //                     }

        //                     oModel.read("/RequestSet", mReadParams);
        //                 });
        //             });

        //             Promise.all(aPromises)
        //                 .then(aResults => {
        //                     const aCombinedResults = aResults.flat();
        //                     console.log("Combined RequestSet Data:", aCombinedResults);

        //                     const oHistoryModel = new sap.ui.model.json.JSONModel({ items: aCombinedResults });
        //                     this.getView().setModel(oHistoryModel, "historyModel");

        //                     this._oBusy.close();
        //                 })
        //                 .catch(oError => {
        //                     console.error("Error combining data from all services:", oError);
        //                     sap.m.MessageBox.error("Failed to load request data from all services.");
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
        //     const aODataModels = [
        //         this.getOwnerComponent().getModel(),
        //         this.getOwnerComponent().getModel("Promotion"),
        //         this.getOwnerComponent().getModel("StatusChange"),
        //         this.getOwnerComponent().getModel("Assignment"),
        //         this.getOwnerComponent().getModel("Demotion"),
        //         this.getOwnerComponent().getModel("Acting"),
        //     ];

        //     this._oBusy.open();

        //     this._currentUser()
        //         .then(oCurrentUser => {
        //             const sLoggedInEmployeeId = oCurrentUser.EmployeeNumber;
        //             console.log("Logged-in Employee ID:", sLoggedInEmployeeId);

        //             // Define filters for PicNumber
        //             const aFilters = [
        //                 new sap.ui.model.Filter("PicNumber", sap.ui.model.FilterOperator.EQ, sLoggedInEmployeeId)
        //             ];

        //             // Fetch data from all OData services
        //             const aPromises = aODataModels.map(oModel => {
        //                 return new Promise((resolve, reject) => {
        //                     if (!oModel) {
        //                         console.warn("OData model not available for one of the services.");
        //                         resolve([]);
        //                         return;
        //                     }

        //                     oModel.read("/RequestSet", {
        //                         filters: aFilters,
        //                         urlParameters: { "$expand": "toApproval" },
        //                         success: function (oRequestData) {
        //                             // Filter results where EmployeeNumber also matches the logged-in user
        //                             const aFilteredResults = oRequestData.results.filter(request =>
        //                                 request.EmployeeNumber === sLoggedInEmployeeId ||
        //                                 request.PicNumber === sLoggedInEmployeeId 
        //                             );

        //                             //add logic to check if current user is dm staff (get from employee detail set "isHR >> X") can display all request from all actions

        //                             const aDetailPromises = aFilteredResults.map(request => {
        //                                 return new Promise((resolveDetail, rejectDetail) => {
        //                                     oModel.read(`/EmployeeDetailSet('${request.EmployeeNumber}')`, {
        //                                         success: function (oEmployeeData) {
        //                                             const sRequestPath = `/RequestSet(guid'${request.RequestId}')/toApproval`;
        //                                             oModel.read(sRequestPath, {
        //                                                 success: function (oApprovalData) {
        //                                                     const aApprovals = oApprovalData.results || [];
        //                                                     const oLatestApproval = aApprovals.length > 0 ? aApprovals[aApprovals.length - 1] : null;
        //                                                     let oRelevantApproval = null;

        //                                                     if (request.Status === "A7") { // AMBIL YANG STATUS /TOAPPROVAL "P"
        //                                                         oRelevantApproval = oLatestApproval;
        //                                                     } else {
        //                                                         oRelevantApproval = aApprovals.length > 1 ? aApprovals[aApprovals.length - 2] : null;
        //                                                     }

        //                                                     resolveDetail({
        //                                                         RequestId: request.RequestId,
        //                                                         EmployeeNumber: request.EmployeeNumber,
        //                                                         EmployeeName: oEmployeeData.EmployeeName || request.EmployeeName,
        //                                                         DivisionText: oEmployeeData.DivisionText,
        //                                                         ActionType: oEmployeeData.ActionType,
        //                                                         ActionTypeDesc: oEmployeeData.ActionTypeDesc,
        //                                                         Massg: request.Massg,
        //                                                         PlansDesc_Dest: request.PlansDesc_Dest,
        //                                                         MassgDesc: request.MassgDesc,
        //                                                         ZbegdaEfktf: request.ZbegdaEfktf,
        //                                                         ZenddaEfktf: request.ZenddaEfktf,
        //                                                         CreatedOn: request.CreatedOn,
        //                                                         StatusText: oRelevantApproval ? oRelevantApproval.StatusText : request.StatusText,
        //                                                         ApproverName: oLatestApproval ? oLatestApproval.ApproverName : ""
        //                                                     });
        //                                                 },
        //                                                 error: function (oError) {
        //                                                     console.error("Error fetching approval data:", oError);
        //                                                     rejectDetail(oError);
        //                                                 }
        //                                             });
        //                                         },
        //                                         error: function (oError) {
        //                                             console.error("Error fetching employee data:", oError);
        //                                             rejectDetail(oError);
        //                                         }
        //                                     });
        //                                 });
        //                             });

        //                             Promise.all(aDetailPromises)
        //                                 .then(resolve)
        //                                 .catch(reject);
        //                         },
        //                         error: function (oError) {
        //                             console.error("Error loading RequestSet from service:", oError);
        //                             resolve([]);
        //                         }
        //                     });
        //                 });
        //             });

        //             Promise.all(aPromises)
        //                 .then(aResults => {
        //                     const aCombinedResults = aResults.flat();
        //                     console.log("Combined RequestSet Data:", aCombinedResults);

        //                     const oHistoryModel = new sap.ui.model.json.JSONModel({ items: aCombinedResults });
        //                     this.getView().setModel(oHistoryModel, "historyModel");

        //                     this._oBusy.close();
        //                 })
        //                 .catch(oError => {
        //                     console.error("Error combining data from all services:", oError);
        //                     sap.m.MessageBox.error("Failed to load request data from all services.");
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
        //     const aODataModels = [
        //         this.getOwnerComponent().getModel(),
        //         this.getOwnerComponent().getModel("Promotion"),
        //         this.getOwnerComponent().getModel("StatusChange"),
        //         this.getOwnerComponent().getModel("Assignment"),
        //         this.getOwnerComponent().getModel("Demotion"),
        //         this.getOwnerComponent().getModel("Acting"),
        //     ];

        //     this._oBusy.open();

        //     this._currentUser()
        //         .then(oCurrentUser => {
        //             const sLoggedInEmployeeId = oCurrentUser.EmployeeNumber;
        //             console.log("Logged-in Employee ID:", sLoggedInEmployeeId);

        //             // Fetch data from all OData services
        //             const aPromises = aODataModels.map(oModel => {
        //                 return new Promise((resolve, reject) => {
        //                     if (!oModel) {
        //                         console.warn("OData model not available for one of the services.");
        //                         resolve([]);
        //                         return;
        //                     }

        //                     oModel.read("/RequestSet", {
        //                         urlParameters: { "$expand": "toApproval" },
        //                         success: function (oRequestData) {
        //                             console.log("RequestSet loaded from service:", oRequestData);

        //                             // Check the employee number filtering
        //                             console.log("Filtered Employee Number:", sLoggedInEmployeeId);
                                    
        //                             // Only include requests where EmployeeNumber matches the logged-in user
        //                             const aFilteredResults = oRequestData.results.filter(request => {
        //                                 console.log("Request Employee Number:", request.EmployeeNumber);
        //                                 return request.EmployeeNumber === sLoggedInEmployeeId;
        //                             });

        //                             console.log("Filtered Results for Employee:", aFilteredResults);

        //                             const aDetailPromises = aFilteredResults.map(request => {
        //                                 return new Promise((resolveDetail, rejectDetail) => {
        //                                     // Ensure we read the EmployeeDetailSet for each request
        //                                     oModel.read(`/EmployeeDetailSet('${request.EmployeeNumber}')`, {
        //                                         success: function (oEmployeeData) {
        //                                             const sRequestPath = `/RequestSet(guid'${request.RequestId}')/toApproval`;
        //                                             oModel.read(sRequestPath, {
        //                                                 success: function (oApprovalData) {
        //                                                     const aApprovals = oApprovalData.results || [];
        //                                                     const oLatestApproval = aApprovals.length > 0 ? aApprovals[aApprovals.length - 1] : null;
        //                                                     let oRelevantApproval = null;

        //                                                     // Determine the relevant approval based on the status of the request
        //                                                     if (request.Status === "A7") {
        //                                                         oRelevantApproval = oLatestApproval; // Latest for approved requests
        //                                                     } else {
        //                                                         oRelevantApproval = aApprovals.length > 1 ? aApprovals[aApprovals.length - 2] : null; // Second latest for others
        //                                                     }

        //                                                     // Resolve with the enriched data
        //                                                     resolveDetail({
        //                                                         RequestId: request.RequestId,
        //                                                         EmployeeNumber: request.EmployeeNumber,
        //                                                         EmployeeName: oEmployeeData.EmployeeName || request.EmployeeName,
        //                                                         DivisionText: oEmployeeData.DivisionText,
        //                                                         ActionType: oEmployeeData.ActionType,
        //                                                         ActionTypeDesc: oEmployeeData.ActionTypeDesc,
        //                                                         Massg: request.Massg,
        //                                                         PlansDesc_Dest: request.PlansDesc_Dest,
        //                                                         MassgDesc: request.MassgDesc,
        //                                                         ZbegdaEfktf: request.ZbegdaEfktf,
        //                                                         ZenddaEfktf: request.ZenddaEfktf,
        //                                                         CreatedOn: request.CreatedOn,
        //                                                         StatusText: oRelevantApproval ? oRelevantApproval.StatusText : request.StatusText,
        //                                                         ApproverName: oLatestApproval ? oLatestApproval.ApproverName : ""
        //                                                     });
        //                                                 },
        //                                                 error: function (oError) {
        //                                                     console.error("Error fetching approval data:", oError);
        //                                                     rejectDetail(oError);
        //                                                 }
        //                                             });
        //                                         },
        //                                         error: function (oError) {
        //                                             console.error("Error fetching employee data:", oError);
        //                                             rejectDetail(oError);
        //                                         }
        //                                     });
        //                                 });
        //                             });

        //                             // Wait for all detail promises to resolve
        //                             Promise.all(aDetailPromises)
        //                                 .then(resolve)
        //                                 .catch(reject);
        //                         },
        //                         error: function (oError) {
        //                             console.error("Error loading RequestSet: ", oError);
        //                             resolve([]); // Resolve with an empty array on error
        //                         }
        //                     });
        //                 });
        //             });

        //             // Process all promises and combine results
        //             Promise.all(aPromises)
        //                 .then(aResults => {
        //                     const aCombinedResults = aResults.flat();
        //                     console.log("Combined RequestSet Data:", aCombinedResults);

        //                     const oHistoryModel = new sap.ui.model.json.JSONModel({ items: aCombinedResults });
        //                     this.getView().setModel(oHistoryModel, "historyModel");

        //                     this._oBusy.close();
        //                 })
        //                 .catch(oError => {
        //                     sap.m.MessageBox.error("Failed to load request data from all services.");
        //                     console.error("Overall error during data fetch:", oError); // Log overall error
        //                     this._oBusy.close();
        //                 });
        //         })
        //         .catch(oError => {
        //             sap.m.MessageBox.error("Failed to retrieve logged-in user details.");
        //             console.error("Error fetching current user data:", oError); // Log error retrieving user
        //             this._oBusy.close();
        //         });
        // },

        // fix 2
        // _getInitialData: function () {
        //     const aODataModels = [
        //         this.getOwnerComponent().getModel(),
        //         this.getOwnerComponent().getModel("Promotion"),
        //         this.getOwnerComponent().getModel("StatusChange"),
        //         this.getOwnerComponent().getModel("Assignment"),
        //         this.getOwnerComponent().getModel("Demotion"),
        //         this.getOwnerComponent().getModel("Acting"),
        //     ];
        
        //     this._oBusy.open();
        
        //     this._currentUser()
        //         .then(oCurrentUser => {
        //             const sLoggedInEmployeeId = oCurrentUser.EmployeeNumber;
        //             console.log("Logged-in Employee ID:", sLoggedInEmployeeId);
        
        //             // Define filters for the logged-in user's requests
        //             const aFilters = [
        //                 new sap.ui.model.Filter("PicNumber", sap.ui.model.FilterOperator.EQ, sLoggedInEmployeeId)
        //             ];
        
        //             // Fetch data from all OData services
        //             const aPromises = aODataModels.map(oModel => {
        //                 return new Promise((resolve, reject) => {
        //                     if (!oModel) {
        //                         console.warn("OData model not available for one of the services.");
        //                         resolve([]); 
        //                         return;
        //                     }
        
        //                     oModel.read("/RequestSet", {
        //                         filters: aFilters,
        //                         urlParameters: { "$expand": "toApproval" },
        //                         success: function (oRequestData) {
        //                             console.log("RequestSet loaded from service:", oRequestData);
        
        //                             // Filter the results on the frontend to ensure only matching PicNumber is included
        //                             const aFilteredResults = oRequestData.results.filter(request => request.PicNumber === sLoggedInEmployeeId);
        
        //                             const aDetailPromises = aFilteredResults.map(request => {
        //                                 return new Promise((resolveDetail, rejectDetail) => {
        //                                     oModel.read(`/EmployeeDetailSet('${request.EmployeeNumber}')`, {
        //                                         success: function (oEmployeeData) {
        //                                             const sRequestPath = `/RequestSet(guid'${request.RequestId}')/toApproval`;
        //                                             oModel.read(sRequestPath, {
        //                                                 success: function (oApprovalData) {
        //                                                     console.log("Approval Data:", oApprovalData);
        //                                                     const aApprovals = oApprovalData.results || [];
        //                                                     const oLatestApproval = aApprovals.length > 0 ? aApprovals[aApprovals.length - 1] : null;
        //                                                     let oRelevantApproval = null;

        //                                                     if (request.Status === "A7") {
        //                                                         oRelevantApproval = aApprovals[aApprovals.length - 1];
        //                                                     } else {
        //                                                         oRelevantApproval = aApprovals.length > 1
        //                                                             ? aApprovals[aApprovals.length - 2]
        //                                                             : null;
        //                                                     }

        //                                                     resolveDetail({
        //                                                         RequestId: request.RequestId,
        //                                                         EmployeeNumber: request.EmployeeNumber,
        //                                                         EmployeeName: oEmployeeData.EmployeeName || request.EmployeeName,
        //                                                         DivisionText: oEmployeeData.DivisionText,
        //                                                         ActionType: oEmployeeData.ActionType,
        //                                                         ActionTypeDesc: oEmployeeData.ActionTypeDesc,
        //                                                         Massg: request.Massg,
        //                                                         PlansDesc_Dest: request.PlansDesc_Dest,
        //                                                         MassgDesc: request.MassgDesc,
        //                                                         ZbegdaEfktf: request.ZbegdaEfktf,
        //                                                         ZenddaEfktf: request.ZenddaEfktf,
        //                                                         CreatedOn: request.CreatedOn,
        //                                                         StatusText: oRelevantApproval ? oRelevantApproval.StatusText : request.StatusText, 
        //                                                         ApproverName: oLatestApproval ? oLatestApproval.ApproverName : ""
        //                                                     });
        //                                                 },
        //                                                 error: function (oError) {
        //                                                     console.error(`Error loading toApproval for RequestId ${request.RequestId}:`, oError);
        //                                                     rejectDetail(oError);
        //                                                 }
        //                                             });
        //                                         },
        //                                         error: function (oError) {
        //                                             console.error(`Error loading EmployeeDetailSet for EmployeeNumber ${request.EmployeeNumber}:`, oError);
        //                                             rejectDetail(oError);
        //                                         }
        //                                     });
        //                                 });
        //                             });
        
        //                             Promise.all(aDetailPromises)
        //                                 .then(resolve)
        //                                 .catch(reject);
        //                         },
        //                         error: function (oError) {
        //                             console.error("Error loading RequestSet from service:", oError);
        //                             resolve([]); 
        //                         }
        //                     });
        //                 });
        //             });
        
        //             Promise.all(aPromises)
        //                 .then(aResults => {
        //                     const aCombinedResults = aResults.flat();
        //                     console.log("Combined RequestSet Data:", aCombinedResults);
        
        //                     const oHistoryModel = new sap.ui.model.json.JSONModel({ items: aCombinedResults });
        //                     this.getView().setModel(oHistoryModel, "historyModel");
        
        //                     this._oBusy.close();
        //                 })
        //                 .catch(oError => {
        //                     console.error("Error combining data from all services:", oError);
        //                     sap.m.MessageBox.error("Failed to load request data from all services.");
        //                     this._oBusy.close();
        //                 });
        //         })
        //         .catch(oError => {
        //             console.error("Error retrieving current user:", oError);
        //             sap.m.MessageBox.error("Failed to retrieve logged-in user details.");
        //             this._oBusy.close();
        //         });
        // },

        // fix
        // _getInitialData: function () {
        //     const aODataModels = [
        //         this.getOwnerComponent().getModel(),
        //         this.getOwnerComponent().getModel("Promotion"),
        //         this.getOwnerComponent().getModel("StatusChange"),
        //         this.getOwnerComponent().getModel("Assignment"),
        //         this.getOwnerComponent().getModel("Demotion"),
        //         this.getOwnerComponent().getModel("Acting"),
        //     ];
        
        //     this._oBusy.open();
        
        //     this._currentUser()
        //         .then(oCurrentUser => {
        //             const sLoggedInEmployeeId = oCurrentUser.EmployeeNumber;
        //             console.log("Logged-in Employee ID:", sLoggedInEmployeeId);
        
        //             // Define filters for the logged-in user's requests
        //             const aFilters = [
        //                 new sap.ui.model.Filter("PicNumber", sap.ui.model.FilterOperator.EQ, sLoggedInEmployeeId)
        //             ];
        
        //             // Fetch data from all OData services
        //             const aPromises = aODataModels.map(oModel => {
        //                 return new Promise((resolve, reject) => {
        //                     if (!oModel) {
        //                         console.warn("OData model not available for one of the services.");
        //                         resolve([]);
        //                         return;
        //                     }
        
        //                     oModel.read("/RequestSet", {
        //                         filters: aFilters,
        //                         urlParameters: { "$expand": "toApproval" }, // Expand toApproval
        //                         success: function (oRequestData) {
        //                             console.log("RequestSet loaded from service:", oRequestData);
        
        //                             // Filter requests where PicNumber matches the logged-in EmployeeNumber
        //                             const aFilteredRequests = oRequestData.results.filter(request => {
        //                                 return request.PicNumber === sLoggedInEmployeeId;
        //                             });
        
        //                             // Include all requests, even those without approvals
        //                             const aDetailPromises = aFilteredRequests.map(request => {
        //                                 return new Promise((resolveDetail, rejectDetail) => {
        //                                     oModel.read(`/EmployeeDetailSet('${request.EmployeeNumber}')`, {
        //                                         success: function (oEmployeeData) {
        //                                             const sRequestPath = `/RequestSet(guid'${request.RequestId}')/toApproval`;
        //                                             oModel.read(sRequestPath, {
        //                                                 success: function (oApprovalData) {
        //                                                     console.log("Approval Data:", oApprovalData);
        //                                                     const aApprovals = oApprovalData.results || [];
        //                                                     let oRelevantApproval = null;
        
        //                                                     // Check if the request is posted
        //                                                     if (request.Status === "A7") {
        //                                                         oRelevantApproval = aApprovals[aApprovals.length - 1];
        //                                                     } else {
        //                                                         oRelevantApproval = aApprovals.length > 1
        //                                                             ? aApprovals[aApprovals.length - 2]
        //                                                             : null;
        //                                                     }
        
        //                                                     resolveDetail({
        //                                                         RequestId: request.RequestId,
        //                                                         EmployeeNumber: request.EmployeeNumber,
        //                                                         EmployeeName: oEmployeeData.EmployeeName || request.EmployeeName,
        //                                                         DivisionText: oEmployeeData.DivisionText,
        //                                                         ActionType: oEmployeeData.ActionType,
        //                                                         ActionTypeDesc: oEmployeeData.ActionTypeDesc,
        //                                                         Massg: request.Massg,
        //                                                         PlansDesc_Dest: request.PlansDesc_Dest,
        //                                                         MassgDesc: request.MassgDesc,
        //                                                         ZbegdaEfktf: request.ZbegdaEfktf,
        //                                                         ZenddaEfktf: request.ZenddaEfktf,
        //                                                         CreatedOn: request.CreatedOn,
        //                                                         StatusText: oRelevantApproval ? oRelevantApproval.StatusText : request.StatusText,
        //                                                         ApproverName: oRelevantApproval ? oRelevantApproval.ApproverName : "No Approver"
        //                                                     });
        //                                                 },
        //                                                 error: function () {
        //                                                     // If no approval data exists, still resolve with the request data
        //                                                     resolveDetail({
        //                                                         RequestId: request.RequestId,
        //                                                         EmployeeNumber: request.EmployeeNumber,
        //                                                         EmployeeName: oEmployeeData.EmployeeName || request.EmployeeName,
        //                                                         DivisionText: oEmployeeData.DivisionText,
        //                                                         ActionType: oEmployeeData.ActionType,
        //                                                         ActionTypeDesc: oEmployeeData.ActionTypeDesc,
        //                                                         Massg: request.Massg,
        //                                                         PlansDesc_Dest: request.PlansDesc_Dest,
        //                                                         MassgDesc: request.MassgDesc,
        //                                                         ZbegdaEfktf: request.ZbegdaEfktf,
        //                                                         ZenddaEfktf: request.ZenddaEfktf,
        //                                                         CreatedOn: request.CreatedOn,
        //                                                         StatusText: request.StatusText, // Use request's status if no approval data
        //                                                         ApproverName: "No Approver"
        //                                                     });
        //                                                 }
        //                                             });
        //                                         },
        //                                         error: function (oError) {
        //                                             console.error(`Error loading EmployeeDetailSet for EmployeeNumber ${request.EmployeeNumber}:`, oError);
        //                                             rejectDetail(oError);
        //                                         }
        //                                     });
        //                                 });
        //                             });
        
        //                             Promise.all(aDetailPromises)
        //                                 .then(resolve)
        //                                 .catch(reject);
        //                         },
        //                         error: function (oError) {
        //                             console.error("Error loading RequestSet from service:", oError);
        //                             resolve([]);
        //                         }
        //                     });
        //                 });
        //             });
        
        //             Promise.all(aPromises)
        //                 .then(aResults => {
        //                     const aCombinedResults = aResults.flat();
        //                     console.log("Filtered RequestSet Data:", aCombinedResults);
        
        //                     const oHistoryModel = new sap.ui.model.json.JSONModel({ items: aCombinedResults });
        //                     this.getView().setModel(oHistoryModel, "historyModel");
        
        //                     this._oBusy.close();
        //                 })
        //                 .catch(oError => {
        //                     console.error("Error combining data from all services:", oError);
        //                     sap.m.MessageBox.error("Failed to load request data from all services.");
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
        //     const aODataModels = [
        //         this.getOwnerComponent().getModel(),
        //         this.getOwnerComponent().getModel("Promotion"),
        //         this.getOwnerComponent().getModel("StatusChange"),
        //         this.getOwnerComponent().getModel("Assignment"),
        //         this.getOwnerComponent().getModel("Demotion"),
        //         this.getOwnerComponent().getModel("Acting"),
        //     ];
        
        //     this._oBusy.open();
        
        //     this._currentUser()
        //         .then(oCurrentUser => {
        //             const sLoggedInEmployeeId = oCurrentUser.EmployeeNumber;
        //             console.log("Logged-in Employee ID:", sLoggedInEmployeeId);
        
        //             // Define filters for the logged-in user's requests
        //             const aFilters = [
        //                 new sap.ui.model.Filter("PicNumber", sap.ui.model.FilterOperator.EQ, sLoggedInEmployeeId)
        //             ];
        
        //             // Fetch data from all OData services
        //             const aPromises = aODataModels.map(oModel => {
        //                 return new Promise((resolve, reject) => {
        //                     if (!oModel) {
        //                         console.warn("OData model not available for one of the services.");
        //                         resolve([]);
        //                         return;
        //                     }
        
        //                     oModel.read("/RequestSet", {
        //                         filters: aFilters,
        //                         urlParameters: { "$expand": "toApproval" }, // Expand toApproval
        //                         success: function (oRequestData) {
        //                             console.log("RequestSet loaded from service:", oRequestData);
        
        //                             // Include all requests, even those without approvals
        //                             const aDetailPromises = oRequestData.results.map(request => {
        //                                 return new Promise((resolveDetail, rejectDetail) => {
        //                                     oModel.read(`/EmployeeDetailSet('${request.EmployeeNumber}')`, {
        //                                         success: function (oEmployeeData) {
        //                                             const sRequestPath = `/RequestSet(guid'${request.RequestId}')/toApproval`;
        //                                             oModel.read(sRequestPath, {
        //                                                 success: function (oApprovalData) {
        //                                                     console.log("Approval Data:", oApprovalData);
        //                                                     const aApprovals = oApprovalData.results || [];
        //                                                     let oRelevantApproval = null;
        
        //                                                     // Check if the request is posted
        //                                                     if (request.Status === "A7") {
        //                                                         oRelevantApproval = aApprovals[aApprovals.length - 1];
        //                                                     } else {
        //                                                         oRelevantApproval = aApprovals.length > 1
        //                                                             ? aApprovals[aApprovals.length - 2]
        //                                                             : null;
        //                                                     }
        
        //                                                     resolveDetail({
        //                                                         RequestId: request.RequestId,
        //                                                         EmployeeNumber: request.EmployeeNumber,
        //                                                         EmployeeName: oEmployeeData.EmployeeName || request.EmployeeName,
        //                                                         DivisionText: oEmployeeData.DivisionText,
        //                                                         ActionType: oEmployeeData.ActionType,
        //                                                         ActionTypeDesc: oEmployeeData.ActionTypeDesc,
        //                                                         Massg: request.Massg,
        //                                                         PlansDesc_Dest: request.PlansDesc_Dest,
        //                                                         MassgDesc: request.MassgDesc,
        //                                                         ZbegdaEfktf: request.ZbegdaEfktf,
        //                                                         ZenddaEfktf: request.ZenddaEfktf,
        //                                                         CreatedOn: request.CreatedOn,
        //                                                         StatusText: oRelevantApproval ? oRelevantApproval.StatusText : request.StatusText,
        //                                                         ApproverName: oRelevantApproval ? oRelevantApproval.ApproverName : "No Approver"
        //                                                     });
        //                                                 },
        //                                                 error: function () {
        //                                                     // If no approval data exists, still resolve with the request data
        //                                                     resolveDetail({
        //                                                         RequestId: request.RequestId,
        //                                                         EmployeeNumber: request.EmployeeNumber,
        //                                                         EmployeeName: oEmployeeData.EmployeeName || request.EmployeeName,
        //                                                         DivisionText: oEmployeeData.DivisionText,
        //                                                         ActionType: oEmployeeData.ActionType,
        //                                                         ActionTypeDesc: oEmployeeData.ActionTypeDesc,
        //                                                         Massg: request.Massg,
        //                                                         PlansDesc_Dest: request.PlansDesc_Dest,
        //                                                         MassgDesc: request.MassgDesc,
        //                                                         ZbegdaEfktf: request.ZbegdaEfktf,
        //                                                         ZenddaEfktf: request.ZenddaEfktf,
        //                                                         CreatedOn: request.CreatedOn,
        //                                                         StatusText: request.StatusText, // Use request's status if no approval data
        //                                                         ApproverName: "No Approver"
        //                                                     });
        //                                                 }
        //                                             });
        //                                         },
        //                                         error: function (oError) {
        //                                             console.error(`Error loading EmployeeDetailSet for EmployeeNumber ${request.EmployeeNumber}:`, oError);
        //                                             rejectDetail(oError);
        //                                         }
        //                                     });
        //                                 });
        //                             });
        
        //                             Promise.all(aDetailPromises)
        //                                 .then(resolve)
        //                                 .catch(reject);
        //                         },
        //                         error: function (oError) {
        //                             console.error("Error loading RequestSet from service:", oError);
        //                             resolve([]);
        //                         }
        //                     });
        //                 });
        //             });
        
        //             Promise.all(aPromises)
        //                 .then(aResults => {
        //                     const aCombinedResults = aResults.flat();
        //                     console.log("Combined RequestSet Data:", aCombinedResults);
        
        //                     const oHistoryModel = new sap.ui.model.json.JSONModel({ items: aCombinedResults });
        //                     this.getView().setModel(oHistoryModel, "historyModel");
        
        //                     this._oBusy.close();
        //                 })
        //                 .catch(oError => {
        //                     console.error("Error combining data from all services:", oError);
        //                     sap.m.MessageBox.error("Failed to load request data from all services.");
        //                     this._oBusy.close();
        //                 });
        //         })
        //         .catch(oError => {
        //             console.error("Error retrieving current user:", oError);
        //             sap.m.MessageBox.error("Failed to retrieve logged-in user details.");
        //             this._oBusy.close();
        //         });
        // },

        onPdfIconPressed: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext("historyModel");
        
            if (!oContext) {
                sap.m.MessageToast.show("No context available for this document.");
                return;
            }
        
            const sEmpNo = oContext.getProperty("EmployeeNumber");
            const sStartDate = oContext.getProperty("ZbegdaEfktf");
            const sEndDate = oContext.getProperty("ZenddaEfktf");
            const sActionType = oContext.getProperty("ActionType"); // Use ActionType or other property to determine the model
            const sNoSK = oContext.getProperty("NoSK");

             // Only allow document generation if NoSK exists and is not empty
            if (!sNoSK) {
                sap.m.MessageToast.show("Dokumen SK belum tersedia untuk request ini.");
                return;
            }

            if (!sEmpNo || !sStartDate || !sEndDate) {
                sap.m.MessageToast.show("Missing required data to load the document.");
                return;
            }
        
            // Format StartDate and EndDate to 'YYYY-MM-DDTHH:mm:ss'
            const sFormattedStartDate = new Date(sStartDate).toISOString().split(".")[0];
            const sFormattedEndDate = new Date(sEndDate).toISOString().split(".")[0];
        
            // Determine the URL based on the ActionType or model
            let sUrl;
            if (sActionType === "ZD") {
                sUrl = `/sap/opu/odata/sap/ZHR_PROMOTION_MAN_SRV_01/PromFormCollection(EmployeeNumber='${sEmpNo}',StartDate=datetime'${sFormattedStartDate}',EndDate=datetime'${sFormattedEndDate}')/$value`;
            } else if (sActionType === "ZC") {
                sUrl = `/sap/opu/odata/sap/ZHR_MOVEMENT_MAN_SRV/MovFormCollection(EmployeeNumber='${sEmpNo}',StartDate=datetime'${sFormattedStartDate}',EndDate=datetime'${sFormattedEndDate}')/$value`;
            } else if (sActionType === "ZF") {
                sUrl = `/sap/opu/odata/sap/ZHR_ACTING_MAN_SRV_01/ActFormCollection(EmployeeNumber='${sEmpNo}',StartDate=datetime'${sFormattedStartDate}',EndDate=datetime'${sFormattedEndDate}')/$value`;
            } else if (sActionType === "ZG") {
                sUrl = `/sap/opu/odata/sap/ZHR_ASSIGNMENT_MAN_SRV_01/AssFormCollection(EmployeeNumber='${sEmpNo}',StartDate=datetime'${sFormattedStartDate}',EndDate=datetime'${sFormattedEndDate}')/$value`;
            } else if (sActionType === "ZE") {
                sUrl = `/sap/opu/odata/sap/ZHR_DEMOTION_MAN_SRV_01/DemoFormCollection(EmployeeNumber='${sEmpNo}',StartDate=datetime'${sFormattedStartDate}',EndDate=datetime'${sFormattedEndDate}')/$value`;
            } else if (sActionType === "ZB") {
                sUrl = `/sap/opu/odata/sap/ZHR_STAT_CHANGE_MAN_SRV_01/StatFormCollection(EmployeeNumber='${sEmpNo}',StartDate=datetime'${sFormattedStartDate}',EndDate=datetime'${sFormattedEndDate}')/$value`;
            } else {
                sap.m.MessageToast.show("Unknown action type. Cannot construct URL.");
                return;
            }
        
            console.log("Generated URL:", sUrl);
            window.open(sUrl, "_blank");
        },

        // onPdfIconPressed: function (oEvent) {
        //     const oContext = oEvent.getSource().getBindingContext("historyModel");
        
        //     if (!oContext) {
        //         sap.m.MessageToast.show("No context available for this document.");
        //         return;
        //     }
        
        //     const sEmpNo = oContext.getProperty("EmployeeNumber");
        //     const sStartDate = oContext.getProperty("ZbegdaEfktf"); 
        //     const sEndDate = oContext.getProperty("ZenddaEfktf");   
        
        //     if (!sEmpNo || !sStartDate || !sEndDate) {
        //         sap.m.MessageToast.show("Missing required data to load the document.");
        //         return;
        //     }
        
        //     // Format StartDate and EndDate to 'YYYY-MM-DDTHH:mm:ss'
        //     const sFormattedStartDate = new Date(sStartDate).toISOString().split(".")[0];
        //     const sFormattedEndDate = new Date(sEndDate).toISOString().split(".")[0];
        
        //     // Construct the URL with all required keys
        //     const sUrl = `/sap/opu/odata/sap/ZHR_MOVEMENT_MAN_SRV/MovFormCollection(EmployeeNumber='${sEmpNo}',StartDate=datetime'${sFormattedStartDate}',EndDate=datetime'${sFormattedEndDate}')/$value`;
        
        //     console.log("Generated URL:", sUrl);
        //     window.open(sUrl, "_blank");
        // },          

        // onPdfIconPressed: function (oEvent) {
        //     // Get the binding context of the clicked button or icon
        //     const oButton = oEvent.getSource();
        //     const oContext = oButton.getBindingContext("historyModel"); // Use the historyModel to get request details
        
        //     if (!oContext) {
        //         sap.m.MessageToast.show("No context available for this document.");
        //         return;
        //     }
        
        //     console.log("Binding Context Data:", oContext.getObject());
        //     const sEmployeeNumber = oContext.getProperty("EmployeeNumber");
        //     const sZbegdaEfktf = oContext.getProperty("ZbegdaEfktf");
        //     const sZenddaEfktf = oContext.getProperty("ZenddaEfktf");
        
        //     if (!sEmployeeNumber || !sZbegdaEfktf || !sZenddaEfktf) {
        //         sap.m.MessageToast.show("Missing data to load the document.");
        //         return;
        //     }
        
        //     // Submit MovForm data
        //     this.loadMovForm(sEmployeeNumber, sZbegdaEfktf, sZenddaEfktf);
        
        //     // After loading MovForm, retrieve the URL and open the PDF
        //     const oMovFormModel = this.getView().getModel("MovForm");
        //     if (oMovFormModel) {
        //         const sUrl = oMovFormModel.getProperty("/Url");
        
        //         if (sUrl) {
        //             window.open(sUrl, "_blank");
        //         } else {
        //             sap.m.MessageToast.show("No URL available for this document.");
        //         }
        //     } else {
        //         sap.m.MessageToast.show("Failed to load MovForm data.");
        //     }
        // },

        handleFilterButtonPressed: function() {
            if (!this._oFilterSortDialog) {
                this._oFilterSortDialog = sap.ui.xmlfragment(
                    "bsim.hcmapp.man.movement.view.fragments.FilterSortDialog",
                    this
                );
                this.getView().addDependent(this._oFilterSortDialog);
            }
            this._oFilterSortDialog.open();
        },

        handleSortButtonPressed: function() {
            this.handleFilterButtonPressed(); // Use the same dialog for both
        },

        onFilterSortDialogApply: function() {
            this.onFilterSortHistory(); // Call your filter/sort logic
            if (this._oFilterSortDialog) {
                this._oFilterSortDialog.close();
            }
        },

        onFilterSortDialogCancel: function() {
            if (this._oFilterSortDialog) {
                this._oFilterSortDialog.close();
            }
        },

        // onFilterSortHistory: function() {
        //     var oView = this.getView();
        //     var oModel = oView.getModel("historyModel");
        //     var aItems = oModel.getProperty("/items") || [];

        //     // Get filter values from controls (replace with your actual control IDs)
        //     var sEmployee = oView.byId("FieldEmployee")?.getValue()?.toLowerCase() || "";
        //     var sActionType = oView.byId("FieldActionType")?.getSelectedKey() || "";
        //     var dDateActionFrom = oView.byId("FieldDateActionFrom")?.getDateValue();
        //     var dDateActionTo = oView.byId("FieldDateActionTo")?.getDateValue();
        //     var dDateRequestFrom = oView.byId("FieldDateRequestFrom")?.getDateValue();
        //     var dDateRequestTo = oView.byId("FieldDateRequestTo")?.getDateValue();
        //     var sStatus = oView.byId("FieldStatus")?.getSelectedKey() || "";
        //     var sPersonResponsible = oView.byId("FieldPersonResponsible")?.getValue()?.toLowerCase() || "";
        //     var sSortField = oView.byId("FieldSort")?.getSelectedKey() || "";
        //     var bSortDescending = oView.byId("FieldSortOrder")?.getSelectedKey() === "desc";

        //     // Filter logic
        //     var aFiltered = aItems.filter(function(item) {
        //         var bEmployee = !sEmployee ||
        //             (item.EmployeeName && item.EmployeeName.toLowerCase().includes(sEmployee)) ||
        //             (item.EmployeeNumber && item.EmployeeNumber.toLowerCase().includes(sEmployee));
        //         var bActionType = !sActionType || item.ActionType === sActionType;
        //         var bDateAction = true;
        //         if (dDateActionFrom || dDateActionTo) {
        //             var dAction = item.ZbegdaEfktf ? new Date(item.ZbegdaEfktf) : null;
        //             bDateAction = (!dDateActionFrom || (dAction && dAction >= dDateActionFrom)) &&
        //                         (!dDateActionTo || (dAction && dAction <= dDateActionTo));
        //         }
        //         var bDateRequest = true;
        //         if (dDateRequestFrom || dDateRequestTo) {
        //             var dRequest = item.CreatedOn ? new Date(item.CreatedOn) : null;
        //             bDateRequest = (!dDateRequestFrom || (dRequest && dRequest >= dDateRequestFrom)) &&
        //                         (!dDateRequestTo || (dRequest && dRequest <= dDateRequestTo));
        //         }
        //         var bStatus = !sStatus || item.StatusText === sStatus;
        //         var bPersonResponsible = !sPersonResponsible ||
        //             (item.ApproverName && item.ApproverName.toLowerCase().includes(sPersonResponsible));
        //         return bEmployee && bActionType && bDateAction && bDateRequest && bStatus && bPersonResponsible;
        //     });

        //     // Sort logic
        //     if (sSortField) {
        //         aFiltered.sort(function(a, b) {
        //             var vA = a[sSortField];
        //             var vB = b[sSortField];
        //             // For date fields, convert to Date
        //             if (sSortField === "ZbegdaEfktf" || sSortField === "ZenddaEfktf" || sSortField === "CreatedOn") {
        //                 vA = vA ? new Date(vA) : new Date(0);
        //                 vB = vB ? new Date(vB) : new Date(0);
        //             }
        //             if (vA < vB) return bSortDescending ? 1 : -1;
        //             if (vA > vB) return bSortDescending ? -1 : 1;
        //             return 0;
        //         });
        //     }

        //     // Update the filtered/sorted data
        //     oModel.setProperty("/filteredItems", aFiltered);
        // },

        onFilterSortHistory: function() {
            var oView = this.getView();
            var oModel = oView.getModel("historyModel");
            var aItems = oModel.getProperty("/items") || [];

            // Helper to get control value from fragment or view
            function getControlValue(sId, sMethod, bToLower) {
                var v = null;
                // Try fragment first
                if (this._oFilterSortDialog && this._oFilterSortDialog.isOpen && this._oFilterSortDialog.isOpen()) {
                    var oCtrl = sap.ui.core.Fragment.byId("filterSortDialog", sId);
                    if (oCtrl && typeof oCtrl[sMethod] === "function") {
                        v = oCtrl[sMethod]();
                    }
                }
                // Fallback to view
                if (v == null || v === "") {
                    var oCtrlView = oView.byId(sId);
                    if (oCtrlView && typeof oCtrlView[sMethod] === "function") {
                        v = oCtrlView[sMethod]();
                    }
                }
                if (bToLower && typeof v === "string") {
                    return v.toLowerCase();
                }
                return v || "";
            }

            var sEmployee = getControlValue.call(this, "FieldEmployee", "getValue", true);
            var sActionType = getControlValue.call(this, "FieldActionType", "getSelectedKey");
            var dDateActionFrom = getControlValue.call(this, "FieldDateActionFrom", "getDateValue");
            var dDateActionTo = getControlValue.call(this, "FieldDateActionTo", "getDateValue");
            var dDateRequestFrom = getControlValue.call(this, "FieldDateRequestFrom", "getDateValue");
            var dDateRequestTo = getControlValue.call(this, "FieldDateRequestTo", "getDateValue");
            var sStatus = getControlValue.call(this, "FieldStatus", "getSelectedKey");
            var sPersonResponsible = getControlValue.call(this, "FieldPersonResponsible", "getValue", true);
            var sSortField = getControlValue.call(this, "FieldSort", "getSelectedKey");
            var bSortDescending = getControlValue.call(this, "FieldSortOrder", "getSelectedKey") === "desc";

            // Filter logic
            var aFiltered = aItems.filter(function(item) {
                var bEmployee = !sEmployee ||
                    (item.EmployeeName && item.EmployeeName.toLowerCase().includes(sEmployee)) ||
                    (item.EmployeeNumber && item.EmployeeNumber.toLowerCase().includes(sEmployee));
                var bActionType = !sActionType || item.ActionType === sActionType;
                var bDateAction = true;
                if (dDateActionFrom || dDateActionTo) {
                    var dAction = item.ZbegdaEfktf ? new Date(item.ZbegdaEfktf) : null;
                    bDateAction = (!dDateActionFrom || (dAction && dAction >= dDateActionFrom)) &&
                                (!dDateActionTo || (dAction && dAction <= dDateActionTo));
                }
                var bDateRequest = true;
                if (dDateRequestFrom || dDateRequestTo) {
                    var dRequest = item.CreatedOn ? new Date(item.CreatedOn) : null;
                    bDateRequest = (!dDateRequestFrom || (dRequest && dRequest >= dDateRequestFrom)) &&
                                (!dDateRequestTo || (dRequest && dRequest <= dDateRequestTo));
                }
                var bStatus = !sStatus || item.StatusText === sStatus;
                var bPersonResponsible = !sPersonResponsible ||
                    (item.ApproverName && item.ApproverName.toLowerCase().includes(sPersonResponsible));
                return bEmployee && bActionType && bDateAction && bDateRequest && bStatus && bPersonResponsible;
            });

            // Sort logic
            if (sSortField) {
                aFiltered.sort(function(a, b) {
                    var vA = a[sSortField];
                    var vB = b[sSortField];
                    // For date fields, convert to Date
                    if (sSortField === "ZbegdaEfktf" || sSortField === "ZenddaEfktf" || sSortField === "CreatedOn") {
                        vA = vA ? new Date(vA) : new Date(0);
                        vB = vB ? new Date(vB) : new Date(0);
                    }
                    if (vA < vB) return bSortDescending ? 1 : -1;
                    if (vA > vB) return bSortDescending ? -1 : 1;
                    return 0;
                });
            }

            // Update the filtered/sorted data
            oModel.setProperty("/filteredItems", aFiltered);
        },

        onExportTable: function() {
            var oModel = this.getView().getModel("historyModel");
            var aItems = oModel.getProperty("/items") || [];
            if (!aItems.length) {
                sap.m.MessageToast.show("No data to export.");
                return;
            }

            var aCols = this.createColumnConfig();

            var oSettings = {
                workbook: {
                    columns: aCols
                },
                dataSource: aItems,
                fileName: "HistoryExport.xlsx",
                worker: false // Set to true if not using MockServer
            };

            var oSheet = new Spreadsheet(oSettings);
            oSheet.build().finally(function () {
                oSheet.destroy();
            });
        },

        // onExportTable: function() {
        //     var oModel = this.getView().getModel("historyModel");
        //     var aItems = oModel.getProperty("/items") || [];

        //     if (!aItems.length) {
        //         sap.m.MessageToast.show("No data to export.");
        //         return;
        //     }

        //     // Define columns to export (adjust as needed)
        //     var aColumns = [
        //         { label: "Employee Number", prop: "EmployeeNumber" },
        //         { label: "Employee Name", prop: "EmployeeName" },
        //         { label: "Action Type", prop: "ActionType" },
        //         { label: "Action Type Desc", prop: "ActionTypeDesc" },
        //         { label: "Action Reason", prop: "MassgDesc" },
        //         { label: "Date Action", prop: "ZbegdaEfktf" },
        //         { label: "Date Request", prop: "CreatedOn" },
        //         { label: "Status", prop: "StatusText" },
        //         { label: "Person Responsible", prop: "ApproverName" }
        //     ];

        //     // Helper to format date as YYYY-MM-DD
        //     function formatDate(val) {
        //         if (!val) return "";
        //         var d = new Date(val);
        //         if (isNaN(d)) return "";
        //         return d.toISOString().slice(0, 10);
        //     }

        //     // Build CSV content with BOM for Excel
        //     var sCsv = "\uFEFF" + aColumns.map(col => `"${col.label}"`).join(",") + "\n";
        //     aItems.forEach(function(item) {
        //         sCsv += aColumns.map(function(col) {
        //             var v = item[col.prop];
        //             // Format dates for Excel
        //             if (col.prop === "ZbegdaEfktf" || col.prop === "CreatedOn") {
        //                 v = formatDate(v);
        //             }
        //             // Escape quotes
        //             if (typeof v === "string") {
        //                 v = v.replace(/"/g, '""');
        //             }
        //             return `"${v != null ? v : ""}"`;
        //         }).join(",") + "\n";
        //     });

        //     // Download CSV
        //     var sFilename = "HistoryExport.csv";
        //     var oBlob = new Blob([sCsv], { type: "text/csv;charset=utf-8;" });
        //     if (window.navigator.msSaveBlob) { // IE 10+
        //         window.navigator.msSaveBlob(oBlob, sFilename);
        //     } else {
        //         var link = document.createElement("a");
        //         if (link.download !== undefined) {
        //             var url = URL.createObjectURL(oBlob);
        //             link.setAttribute("href", url);
        //             link.setAttribute("download", sFilename);
        //             document.body.appendChild(link);
        //             link.click();
        //             document.body.removeChild(link);
        //         }
        //     }
        // },

        // onExportTable: function() {
        //     var oModel = this.getView().getModel("historyModel");
        //     // Use filteredItems so only visible rows are exported
        //     var aItems = oModel.getProperty("/items") || [];

        //     if (!aItems.length) {
        //         sap.m.MessageToast.show("No data to export.");
        //         return;
        //     }

        //     var aColumns = [
        //         { label: "Employee Number", prop: "EmployeeNumber" },
        //         { label: "Employee Name", prop: "EmployeeName" },
        //         { label: "Action Type", prop: "ActionType" },
        //         { label: "Action Type Desc", prop: "ActionTypeDesc" },
        //         { label: "Action Reason", prop: "MassgDesc" },
        //         { label: "Date Action", prop: "ZbegdaEfktf" },
        //         { label: "Date Request", prop: "CreatedOn" },
        //         { label: "Status", prop: "StatusText" },
        //         { label: "Person Responsible", prop: "ApproverName" }
        //     ];

        //     function formatDate(val) {
        //         if (!val) return "";
        //         var d = new Date(val);
        //         if (isNaN(d)) return "";
        //         return d.toISOString().slice(0, 10);
        //     }

        //     // Build CSV content with BOM for Excel, each row separated by \r\n
        //     var sCsv = "\uFEFF" + aColumns.map(col => `"${col.label}"`).join(",") + "\r\n";
        //     aItems.forEach(function(item) {
        //         sCsv += aColumns.map(function(col) {
        //             var v = item[col.prop];
        //             if (col.prop === "ZbegdaEfktf" || col.prop === "CreatedOn") {
        //                 v = formatDate(v);
        //             }
        //             if (typeof v === "string") {
        //                 v = v.replace(/"/g, '""');
        //             }
        //             return `"${v != null ? v : ""}"`;
        //         }).join(",") + "\r\n";
        //     });

        //     var sFilename = "HistoryExport.csv";
        //     var oBlob = new Blob([sCsv], { type: "text/csv;charset=utf-8;" });
        //     if (window.navigator.msSaveBlob) {
        //         window.navigator.msSaveBlob(oBlob, sFilename);
        //     } else {
        //         var link = document.createElement("a");
        //         if (link.download !== undefined) {
        //             var url = URL.createObjectURL(oBlob);
        //             link.setAttribute("href", url);
        //             link.setAttribute("download", sFilename);
        //             document.body.appendChild(link);
        //             link.click();
        //             document.body.removeChild(link);
        //         }
        //     }
        // },

        onNavBack: function () {
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("overview", {}, true);
        }

        // onNavBack: function () {
        //     var oHistory = sap.ui.core.routing.History.getInstance();
        //     var sPreviousHash = oHistory.getPreviousHash();

        //     if (sPreviousHash !== undefined) {
        //         window.history.go(-1);
        //     } else {
        //         var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        //         oRouter.navTo("overview", {}, true);
        //     }
        // }
        
    });
});