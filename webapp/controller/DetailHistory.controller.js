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

    return BaseController.extend("bsim.hcmapp.man.movement.controller.DetailHistory", {
        formatter: formatter,

        onInit: function () {
            this._oView = this.getView();
            this._oComponent = this.getOwnerComponent();
            this._oView.addStyleClass(this._oComponent.getContentDensityClass());
            this._oBusy = new sap.m.BusyDialog();
            this._oDetailHistoryModel = new JSONModel();
            this.getView().setModel(this._oDetailHistoryModel, "detailHistoryModel");
            this.getRouter().getRoute("detailhistory").attachPatternMatched(this._onDetailHistoryRouteMatched, this);

            const oDropdownModel = new sap.ui.model.json.JSONModel({
                asColl: [
                    { key: "1", text: "Baru" },
                    { key: "2", text: "Pengganti" }
                ],
                salaryAdjColl : [
                    { key: "1", text: "Ya"},
                    { key: "2", text: "Tidak"}
                ]
            });
            this.getView().setModel(oDropdownModel, "dropdown");
        },

        _onDetailHistoryRouteMatched: function (oEvent) {
            var sRequestId = oEvent.getParameter("arguments").RequestId;
            if (this._isValidGuid(sRequestId)) {
                this._getDetailHistoryData(sRequestId);
                this.loadSubmittedDocuments(sRequestId);
                this.loadApprovalHistoryWithRequestor(sRequestId);
            } else {
                console.error("Invalid Request ID format");
                MessageBox.error("Invalid Request ID format");
            }
        },

        _isValidGuid: function (sGuid) {
            var guidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
            return guidRegex.test(sGuid);
        },

        // _getDetailHistoryData: function (sRequestId) {
        //     if (!sRequestId) {
        //         MessageBox.error("No request ID found. Cannot fetch details.");
        //         return;
        //     }
        
        //     // Define the OData models for Promotion and Movement
        //     const oPromotionModel = this.getOwnerComponent().getModel("Promotion");
        //     const oMovementModel = this.getOwnerComponent().getModel();
        
        //     // Try fetching data from the Movement model first
        //     const sPath = `/RequestSet(guid'${sRequestId}')`;
        //     console.log("Fetching details from Movement model:", sPath);
        
        //     oMovementModel.read(sPath, {
        //         success: function (oRequestData) {
        //             console.log("RequestSet data retrieved successfully from Movement model:", oRequestData);
        
        //             // Set the data to the detailHistoryModel
        //             const oDetailHistoryModel = new sap.ui.model.json.JSONModel(oRequestData);
        //             this.getView().setModel(oDetailHistoryModel, "detailHistoryModel");
        //         }.bind(this),
        //         error: function (oError) {
        //             console.warn("Failed to fetch data from Movement model. Trying Promotion model...");
        
        //             // If Movement model fails, try fetching from the Promotion model
        //             oPromotionModel.read(sPath, {
        //                 success: function (oRequestData) {
        //                     console.log("RequestSet data retrieved successfully from Promotion model:", oRequestData);
        
        //                     // Set the data to the detailHistoryModel
        //                     const oDetailHistoryModel = new sap.ui.model.json.JSONModel(oRequestData);
        //                     this.getView().setModel(oDetailHistoryModel, "detailHistoryModel");
        //                 }.bind(this),
        //                 error: function (oError) {
        //                     console.error("Error retrieving RequestSet data from both models:", oError);
        //                     MessageBox.error("Failed to load request data from both Movement and Promotion services.");
        //                 }
        //             });
        //         }.bind(this)
        //     });
        // },

        loadApprovalHistoryWithRequestor: function (sRequestId) {
            if (!sRequestId || !this._isValidGuid(sRequestId)) {
                MessageBox.error("Invalid Request ID format. Cannot fetch approval history.");
                return;
            }

            const aODataModels = [
                this.getOwnerComponent().getModel("Promotion"),
                this.getOwnerComponent().getModel(),
                this.getOwnerComponent().getModel("Demotion"),
                this.getOwnerComponent().getModel("Assignment"),
                this.getOwnerComponent().getModel("StatusChange"),
                this.getOwnerComponent().getModel("Acting")
            ];

            sap.ui.core.BusyIndicator.show(0);

            const fetchData = (oModel) => {
                return new Promise((resolve) => {
                    if (!oModel) {
                        console.warn("OData model not available.");
                        resolve(null);
                        return;
                    }

                    const sRequestPath = `/RequestSet(guid'${sRequestId}')`;
                    const sToApprovalPath = `${sRequestPath}/toApproval`;

                    oModel.read(sRequestPath, {
                        success: function (oRequestData) {
                            // Get requestor info
                            const sEmployeePath = `/EmployeeDetailSet('${oRequestData.PicNumber}')`;
                            oModel.read(sEmployeePath, {
                                success: function (oEmployeeData) {
                                    const sFormattedName = oEmployeeData.EmployeeName?.FormattedName || oEmployeeData.EmployeeName || "Unknown";
                                    const oRequestorEntry = {
                                        ApproverId: oRequestData.PicNumber,
                                        ApproverName: sFormattedName,
                                        ApprovalDate: oRequestData.CreatedOn,
                                        ApprovalTime: oRequestData.CreatedAt,
                                        Status: "Submitted",
                                        StatusText: "Submitted",
                                        Notes: ""
                                    };

                                    oModel.read(sToApprovalPath, {
                                        success: function (oApprovalData) {
                                            const aApprovalHistory = [oRequestorEntry].concat(oApprovalData.results || []);
                                            resolve(aApprovalHistory);
                                        },
                                        error: function () {
                                            resolve([oRequestorEntry]);
                                        }
                                    });
                                },
                                error: function () {
                                    resolve(null);
                                }
                            });
                        },
                        error: function () {
                            resolve(null);
                        }
                    });
                });
            };

            const aPromises = aODataModels.map(fetchData);

            Promise.allSettled(aPromises)
                .then((aResults) => {
                    const aSuccessfulResults = aResults
                        .filter(result => result.status === "fulfilled" && result.value !== null)
                        .map(result => result.value);

                    if (aSuccessfulResults.length > 0) {
                        // Use the first non-empty result
                        const aCombinedApprovalHistory = aSuccessfulResults.find(arr => arr.length > 0) || [];
                        const oApprovalHistoryModel = new sap.ui.model.json.JSONModel({ results: aCombinedApprovalHistory });
                        const oTable = this.getView().byId("idApprTable");
                        if (oTable) {
                            oTable.setModel(oApprovalHistoryModel, "appr");
                        }
                    } else {
                        MessageBox.error("Failed to load approval history from all services.");
                    }
                })
                .catch(() => {
                    MessageBox.error("An unexpected error occurred while loading approval history.");
                })
                .finally(() => {
                    sap.ui.core.BusyIndicator.hide();
                });
        },

        _getDetailHistoryData: function (sRequestId) {
            if (!sRequestId || !this._isValidGuid(sRequestId)) {
                MessageBox.error("Invalid Request ID format. Cannot fetch details.");
                return;
            }
        
            const aODataModels = [
                this.getOwnerComponent().getModel(),
                this.getOwnerComponent().getModel("Promotion"),
                this.getOwnerComponent().getModel("StatusChange"),
                this.getOwnerComponent().getModel("Assignment"),
                this.getOwnerComponent().getModel("Demotion"),
                this.getOwnerComponent().getModel("Acting"),
            ];
        
            this._oBusy.open();
        
            const fetchData = (oModel) => {
                return new Promise((resolve, reject) => {
                    if (!oModel) {
                        console.warn("OData model not available.");
                        reject("Model not available");
                        return;
                    }

                    const sRequestPath = `/RequestSet(guid'${sRequestId}')`;
                    oModel.read(sRequestPath, {
                        success: function (oRequestData) {
                            console.log("RequestSet data retrieved successfully:", oRequestData);
        
                            const sEmployeeNumber = oRequestData.EmployeeNumber;
                            const sEmployeePath = `/EmployeeDetailSet('${sEmployeeNumber}')`;
                            oModel.read(sEmployeePath, {
                                success: function (oEmployeeData) {
                                    console.log("EmployeeDetailSet data retrieved successfully:", oEmployeeData);
        
                                    const sApprovalPath = `/RequestSet(guid'${sRequestId}')/toApproval`;
                                    oModel.read(sApprovalPath, {
                                        success: function (oApprovalData) {
                                            console.log("Approval data retrieved successfully:", oApprovalData.results);
        
                                            const oCombinedData = Object.assign({}, oRequestData, oEmployeeData, {
                                                ApprovalHistory: oApprovalData.results
                                            });
        
                                            resolve(oCombinedData);
                                        }.bind(this),
                                        error: function (oError) {
                                            console.error("Error retrieving approval data:", oError);
                                            reject("Failed to load approval history.");
                                        }.bind(this)
                                    });
                                }.bind(this),
                                error: function (oError) {
                                    console.error("Error retrieving EmployeeDetailSet data:", oError);
                                    reject("Failed to load employee data.");
                                }.bind(this)
                            });
                        }.bind(this),
                        error: function (oError) {
                            console.error("Error retrieving RequestSet data:", oError);
                            reject("Failed to load request data.");
                        }.bind(this)
                    });
                });
            };
    
            const aPromises = aODataModels.map(fetchData);
        
            Promise.any(aPromises)
                .then((oCombinedData) => {
                    console.log("Combined data retrieved successfully:", oCombinedData);
        
                    this._oDetailHistoryModel.setData(oCombinedData);
                })
                .catch((oError) => {
                    console.error("Error retrieving data from all models:", oError);
                    MessageBox.error("Failed to load request data from all services.");
                })
                .finally(() => {
                    this._oBusy.close();
                });
        },

        // _getDetailHistoryData: function (sRequestId) {        
        //     const aODataModels = [
        //         this.getOwnerComponent().getModel("Promotion"), // Promotion OData service
        //         this.getOwnerComponent().getModel() // Movement OData service
        //     ];
        
        //     this._oBusy.open();
        
        //     // Iterate through the models to fetch data
        //     const fetchData = (oModel) => {
        //         return new Promise((resolve, reject) => {
        //             if (!oModel) {
        //                 console.warn("OData model not available.");
        //                 reject("Model not available");
        //                 return;
        //             }
        
        //             // Fetch data from RequestSet
        //             const sRequestPath = `/RequestSet(guid'${sRequestId}')`;
        //             oModel.read(sRequestPath, {
        //                 success: function (oRequestData) {
        //                     console.log("RequestSet data retrieved successfully:", oRequestData);
        
        //                     // Fetch data from EmployeeDetailSet
        //                     const sEmployeeNumber = oRequestData.EmployeeNumber;
        //                     const sEmployeePath = `/EmployeeDetailSet('${sEmployeeNumber}')`;
        //                     oModel.read(sEmployeePath, {
        //                         success: function (oEmployeeData) {
        //                             console.log("EmployeeDetailSet data retrieved successfully:", oEmployeeData);
        
        //                             // Combine data from RequestSet and EmployeeDetailSet
        //                             const oCombinedData = Object.assign({}, oRequestData, oEmployeeData);
        //                             resolve(oCombinedData);
        //                         },
        //                         error: function (oError) {
        //                             console.error("Error retrieving EmployeeDetailSet data:", oError);
        //                             reject("Failed to load employee data");
        //                         }
        //                     });
        //                 },
        //                 error: function (oError) {
        //                     console.error("Error retrieving RequestSet data:", oError);
        //                     reject("Failed to load request data");
        //                 }
        //             });
        //         });
        //     };
        
        //     // Try fetching data from each model
        //     const aPromises = aODataModels.map(fetchData);
        
        //     Promise.any(aPromises)
        //         .then((oCombinedData) => {
        //             console.log("Combined data retrieved successfully:", oCombinedData);
        
        //             // Set the combined data in the DetailHistoryModel
        //             this._oDetailHistoryModel.setData(oCombinedData);
        //         })
        //         .catch((oError) => {
        //             console.error("Error retrieving data from all models:", oError);
        //             MessageBox.error("Failed to load request data from all services.");
        //         })
        //         .finally(() => {
        //             this._oBusy.close();
        //         });
        // },

        // _getDetailHistoryData: function (sRequestId) {
        //     var that = this;
        //     var oModel = this.getView().getModel();
        //     this._oBusy.open();
            
        //     // Retrieve data from RequestSet for the specific request
        //     oModel.read(`/RequestSet(guid'${sRequestId}')`, {
        //         success: function (oRequestData) {
        //             console.log("RequestSet data retrieved successfully:", oRequestData);
        
        //             // Retrieve data from EmployeeDetailSet for the specific employee
        //             var sEmployeeNumber = oRequestData.EmployeeNumber;
        //             oModel.read(`/EmployeeDetailSet('${sEmployeeNumber}')`, {
        //                 success: function (oEmployeeData) {
        //                     console.log("EmployeeDetailSet data retrieved successfully:", oEmployeeData);
        
        //                     // Combine data from RequestSet and EmployeeDetailSet
        //                     var oCombinedData = Object.assign({}, oRequestData, oEmployeeData);
        
        //                     // Set the combined data in the DetailHistoryModel
        //                     that._oDetailHistoryModel.setData(oCombinedData);
        //                     that._oBusy.close();
        //                 },
        //                 error: function (oError) {
        //                     console.error("Error retrieving EmployeeDetailSet data:", oError);
        //                     MessageBox.error("Failed to load employee data");
        //                     that._oBusy.close();
        //                 }
        //             });
        //         },
        //         error: function (oError) {
        //             console.error("Error retrieving RequestSet data:", oError);
        //             MessageBox.error("Failed to load request data");
        //             that._oBusy.close();
        //         }
        //     });
        // },

        // _loadApprovalHistory: function (sRequestId) {
        //     if (!sRequestId || !this._isValidGuid(sRequestId)) {
        //         console.error("Invalid or missing RequestId:", sRequestId);
        //         sap.m.MessageBox.error("Invalid Request ID format. Cannot fetch approval history.");
        //         return;
        //     }
        
        //     // Define the OData models for Promotion and Movement
        //     const aODataModels = [
        //         this.getOwnerComponent().getModel("Promotion"), // Promotion OData service
        //         this.getOwnerComponent().getModel() // Movement OData service
        //     ];
        
        //     this._oBusy.open();
        
        //     // Iterate through the models to fetch approval history
        //     const fetchApprovalHistory = (oModel) => {
        //         return new Promise((resolve, reject) => {
        //             if (!oModel) {
        //                 console.warn("OData model not available.");
        //                 reject("Model not available");
        //                 return;
        //             }
        
        //             // Define the path to fetch approval history
        //             const sApprovalHistoryPath = `/RequestSet(guid'${sRequestId}')/toApproval`;
        
        //             // Fetch approval history data
        //             oModel.read(sApprovalHistoryPath, {
        //                 success: function (oData) {
        //                     console.log("Approval history data fetched successfully:", oData.results);
        //                     resolve(oData.results);
        //                 },
        //                 error: function (oError) {
        //                     console.error("Error fetching approval history data:", oError);
        //                     reject(oError);
        //                 }
        //             });
        //         });
        //     };
        
        //     // Try fetching data from each model
        //     const aPromises = aODataModels.map(fetchApprovalHistory);
        
        //     Promise.any(aPromises)
        //         .then((aApprovalData) => {
        //             console.log("Approval history data retrieved successfully:", aApprovalData);
        
        //             // Set the approval history data to the appr model
        //             const oApprovalHistoryModel = new sap.ui.model.json.JSONModel({ results: aApprovalData });
        //             this.getView().setModel(oApprovalHistoryModel, "appr");
        //         })
        //         .catch((oError) => {
        //             console.error("Error retrieving approval history data from all models:", oError);
        //             sap.m.MessageBox.error("Failed to load approval history data from all services.");
        //         })
        //         .finally(() => {
        //             this._oBusy.close();
        //         });
        // },

        // _loadApprovalHistory: function () {
        //     const oRouter = this.getRouter();
        //     const oRoute = oRouter.getRoute("detailhistory");
        
        //     // Attach a pattern matched event to get the RequestId from the route
        //     oRoute.attachPatternMatched(function (oEvent) {
        //         const sRequestId = oEvent.getParameter("arguments").RequestId; // Get the RequestId from the route arguments
        
        //         if (!sRequestId) {
        //             console.error("No RequestId found in route arguments.");
        //             return;
        //         }
        
        //         const oModel = this.getView().getModel(); // Get the OData model
        
        //         // Define the path to fetch approval history
        //         const sApprovalHistoryPath = `/RequestSet(guid'${sRequestId}')/toApproval`;
        
        //         // Fetch the approval history data
        //         oModel.read(sApprovalHistoryPath, {
        //             success: function (oData) {
        //                 console.log("Approval history data loaded:", oData);
        
        //                 // Create a JSON model for the approval history
        //                 const oApprovalHistoryModel = new sap.ui.model.json.JSONModel({ results: oData.results });
        
        //                 // Set the model to the view
        //                 this.getView().setModel(oApprovalHistoryModel, "appr");
        //             }.bind(this),
        //             error: function (oError) {
        //                 console.error("Error loading approval history data:", oError);
        //                 sap.m.MessageBox.error("Failed to load approval history.");
        //             }
        //         });
        //     }, this);
        // },

        // loadSubmittedDocuments: function (sRequestId) {
        //     if (!sRequestId) {
        //         MessageBox.error("No request ID found. Cannot fetch documents.");
        //         return;
        //     }
        
        //     const oModel = this.getOwnerComponent().getModel();
        //     const oView = this.getView();
        
        //     // Construct the path for toAttachmentView
        //     const sPath = `/RequestSet(guid'${sRequestId}')/toAttachmentView`;
        
        //     // Fetch documents from toAttachmentView
        //     oModel.read(sPath, {
        //         success: function (oData) {
        //             console.log("Documents fetched successfully from toAttachmentView:", oData.results);
        
        //             // Bind the data to the fileAttachment model
        //             const oFileAttachmentModel = new sap.ui.model.json.JSONModel({ results: oData.results });
        //             oView.setModel(oFileAttachmentModel, "fileAttachmentView");
        //         },
        //         error: function (oError) {
        //             console.error("Error fetching documents from toAttachmentView:", oError);
        //             MessageBox.error("Failed to fetch submitted documents.");
        //         }
        //     });
        // },

        loadSubmittedDocuments: function (sRequestId) {
            if (!sRequestId) {
                MessageBox.error("No request ID found. Cannot fetch documents.");
                return;
            }

            const oPromotionModel = this.getOwnerComponent().getModel("Promotion");
            const oStatusChangeModel = this.getOwnerComponent().getModel("StatusChange");
            const oMovementModel = this.getOwnerComponent().getModel();
            const oDemotionModel = this.getOwnerComponent().getModel("Demotion");
            const oActingModel = this.getOwnerComponent().getModel("Acting");
            const oAssignmentModel = this.getOwnerComponent().getModel("Assignment");

        
            const sPath = `/FileAttachmentViewSet`;
            const aFilters = [
                new sap.ui.model.Filter("Reqid", sap.ui.model.FilterOperator.EQ, sRequestId)
            ];
            console.log("Fetching documents from Movement model:", sPath);
        
            oMovementModel.read(sPath, {
                filters: aFilters,
                success: function (oData) {
                    console.log("Documents fetched successfully from Movement model:", oData.results);
        
                    const oFileAttachmentModel = new sap.ui.model.json.JSONModel({ results: oData.results });
                    this.getView().setModel(oFileAttachmentModel, "fileAttachmentView");
                }.bind(this),
                error: function (oError) {
                    console.warn("Failed to fetch documents from Movement model. Trying Promotion model...");
        
                    oPromotionModel.read(sPath, {
                        filters: aFilters,
                        success: function (oData) {
                            console.log("Documents fetched successfully from Promotion model:", oData.results);
        
                            const oFileAttachmentModel = new sap.ui.model.json.JSONModel({ results: oData.results });
                            this.getView().setModel(oFileAttachmentModel, "fileAttachmentView");
                        }.bind(this),
                        error: function (oError) {
                            console.error("Error fetching documents from both models:", oError);
                            MessageBox.error("Failed to fetch submitted documents from both Movement and Promotion services.");
                        }
                    });

                    oStatusChangeModel.read(sPath, {
                        filters: aFilters,
                        success: function (oData) {
                            console.log("Documents fetched successfully from Status Change model:", oData.results);
        
                            const oFileAttachmentModel = new sap.ui.model.json.JSONModel({ results: oData.results });
                            this.getView().setModel(oFileAttachmentModel, "fileAttachmentView");
                        }.bind(this),
                        error: function (oError) {
                            console.error("Error fetching documents from both models:", oError);
                            MessageBox.error("Failed to fetch submitted documents from all services.");
                        }
                    });

                    oAssignmentModel.read(sPath, {
                        filters: aFilters,
                        success: function (oData) {
                            console.log("Documents fetched successfully from Assignment model:", oData.results);
        
                            const oFileAttachmentModel = new sap.ui.model.json.JSONModel({ results: oData.results });
                            this.getView().setModel(oFileAttachmentModel, "fileAttachmentView");
                        }.bind(this),
                        error: function (oError) {
                            console.error("Error fetching documents from both models:", oError);
                            MessageBox.error("Failed to fetch submitted documents from all services.");
                        }
                    });

                    oDemotionModel.read(sPath, {
                        filters: aFilters,
                        success: function (oData) {
                            console.log("Documents fetched successfully from Demotion model:", oData.results);
        
                            const oFileAttachmentModel = new sap.ui.model.json.JSONModel({ results: oData.results });
                            this.getView().setModel(oFileAttachmentModel, "fileAttachmentView");
                        }.bind(this),
                        error: function (oError) {
                            console.error("Error fetching documents from both models:", oError);
                            MessageBox.error("Failed to fetch submitted documents from all services.");
                        }
                    });

                    oActingModel.read(sPath, {
                        filters: aFilters,
                        success: function (oData) {
                            console.log("Documents fetched successfully from Acting model:", oData.results);
        
                            const oFileAttachmentModel = new sap.ui.model.json.JSONModel({ results: oData.results });
                            this.getView().setModel(oFileAttachmentModel, "fileAttachmentView");
                        }.bind(this),
                        error: function (oError) {
                            console.error("Error fetching documents from both models:", oError);
                            MessageBox.error("Failed to fetch submitted documents from all services.");
                        }
                    });

                }.bind(this)
            });
        },

        // loadSubmittedDocuments: function (sRequestId) {
        //     if (!sRequestId) {
        //         MessageBox.error("No request ID found. Cannot fetch documents.");
        //         return;
        //     }
        
        //     const oModel = this.getOwnerComponent().getModel();
        //     const oView = this.getView();
        
        //     // Construct the path for FileAttachmentViewSet
        //     const sPath = `/FileAttachmentViewSet`;
        
        //     // Define filters for the RequestId
        //     const aFilters = [
        //         new sap.ui.model.Filter("Reqid", sap.ui.model.FilterOperator.EQ, sRequestId)
        //     ];
        
        //     // Fetch documents from FileAttachmentViewSet
        //     oModel.read(sPath, {
        //         filters: aFilters,
        //         success: function (oData) {
        //             console.log("Documents fetched successfully from FileAttachmentViewSet:", oData.results);
        
        //             // Bind the data to the fileAttachment model
        //             const oFileAttachmentModel = new sap.ui.model.json.JSONModel({ results: oData.results });
        //             oView.setModel(oFileAttachmentModel, "fileAttachmentView");
        //         },
        //         error: function (oError) {
        //             console.error("Error fetching documents from FileAttachmentViewSet:", oError);
        //             MessageBox.error("Failed to fetch submitted documents.");
        //         }
        //     });
        // },

        onShowDocument: function (oEvent) {
            const oButton = oEvent.getSource();
            const oContext = oButton.getBindingContext("fileAttachmentView");
            const sUrl = oContext.getProperty("Url");
        
            if (sUrl) {
                window.open(sUrl, "_blank");
            } else {
                sap.m.MessageToast.show("No URL available for this document.");
            }
        },

        // loadSubmittedDocuments: function (sRequestId) {
        //     if (!sRequestId) {
        //         MessageBox.error("No request ID found. Cannot fetch documents.");
        //         return;
        //     }
        
        //     const oModel = this.getOwnerComponent().getModel();
        //     const oView = this.getView();
        
        //     // Fetch documents using the toAttachment navigation property
        //     const sPath = `/RequestSet(guid'${sRequestId}')/toAttachment`;
        
        //     oModel.read(sPath, {
        //         success: function (oData) {
        //             console.log("Documents fetched successfully:", oData.results);
        
        //             // Bind the data to the fileAttachment model
        //             const oFileAttachmentModel = new sap.ui.model.json.JSONModel(oData.results);
        //             oView.setModel(oFileAttachmentModel, "fileAttachment");
        //         },
        //         error: function (oError) {
        //             console.error("Error fetching documents:", oError);
        //             MessageBox.error("Failed to fetch submitted documents.");
        //         },
        //     });
        // },

        // loadSubmittedDocuments: function (sRequestId) {
        //     if (!sRequestId) {
        //         MessageBox.error("No request ID found. Cannot fetch documents.");
        //         return;
        //     }
        
        //     const oModel = this.getOwnerComponent().getModel();
        //     const oView = this.getView();
        
        //     // Fetch documents using the toAttachment navigation property
        //     const sPath = `/RequestSet(guid'${sRequestId}')/toAttachment`;
        
        //     oModel.read(sPath, {
        //         success: function (oData) {
        //             console.log("Documents fetched successfully:", oData.results);
        
        //             // Bind the data to the fileAttachment model
        //             const oFileAttachmentModel = new sap.ui.model.json.JSONModel(oData.results);
        //             oView.setModel(oFileAttachmentModel, "fileAttachment");
        //         },
        //         error: function (oError) {
        //             console.error("Error fetching documents:", oError);
        //             MessageBox.error("Failed to fetch submitted documents.");
        //         },
        //     });
        // },

        onNavBack: function () {
            var oHistory = sap.ui.core.routing.History.getInstance();
            var sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
                oRouter.navTo("history", {}, true);
            }
        }

    });
});