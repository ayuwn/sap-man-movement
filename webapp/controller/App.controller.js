sap.ui.define([
    "bsim/hcmapp/man/movement/controller/BaseController",
    "sap/ui/model/json/JSONModel"
  ], (Controller) => {
    "use strict";
  
    return Controller.extend("bsim.hcmapp.man.movement.controller.App", {
        onInit: function() {
          this.getView().addStyleClass(this.getOwnerComponent().getContentDensityClass());
        }
    });
  });